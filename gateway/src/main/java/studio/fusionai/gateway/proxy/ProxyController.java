package studio.fusionai.gateway.proxy;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import studio.fusionai.gateway.ratelimit.RateLimiter;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reverse-proxies /api/** to the FastAPI backend. The caller has already been
 * authenticated by JwtAuthFilter; here we enforce per-user rate limits, strip
 * client-supplied identity headers, inject a verified identity the backend
 * trusts, and stream the response body back unbuffered (so NDJSON arrives
 * token-by-token).
 */
@RestController
public class ProxyController {

    private static final Set<String> HOP_BY_HOP = Set.of(
            "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
            "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length");

    private static final Set<String> LLM_PATHS = Set.of(
            "/api/research", "/api/chat", "/api/research/stream");

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final RateLimiter rateLimiter;
    private final String backendUrl;
    private final String gatewaySecret;
    private final double defaultPerMinute;
    private final double llmPerMinute;

    public ProxyController(RateLimiter rateLimiter,
                           @Value("${fusionai.backend-url}") String backendUrl,
                           @Value("${fusionai.gateway-secret:}") String gatewaySecret,
                           @Value("${fusionai.ratelimit.default-per-minute}") double defaultPerMinute,
                           @Value("${fusionai.ratelimit.llm-per-minute}") double llmPerMinute) {
        this.rateLimiter = rateLimiter;
        this.backendUrl = backendUrl.replaceAll("/+$", "");
        this.gatewaySecret = gatewaySecret == null ? "" : gatewaySecret;
        this.defaultPerMinute = defaultPerMinute;
        this.llmPerMinute = llmPerMinute;
    }

    @RequestMapping("/api/**")
    public void proxy(HttpServletRequest request, HttpServletResponse response) throws IOException {
        var authentication = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        String user = authentication != null ? authentication.getName() : null;
        if (user == null || "anonymousUser".equals(user)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Authentication required");
            return;
        }

        String path = request.getRequestURI();
        boolean isLlm = LLM_PATHS.contains(path);
        double limit = isLlm ? llmPerMinute : defaultPerMinute;
        if (!rateLimiter.allow(user + "|" + (isLlm ? "llm" : "std"), limit)) {
            response.setStatus(429);
            response.setHeader("Retry-After", "5");
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Rate limit exceeded. Please slow down and try again shortly.\"}");
            return;
        }

        String query = request.getQueryString();
        URI target = URI.create(backendUrl + path + (query != null ? "?" + query : ""));

        byte[] body = request.getInputStream().readAllBytes();
        HttpRequest.Builder upstream = HttpRequest.newBuilder(target)
                .timeout(Duration.ofMinutes(3))
                .method(request.getMethod(),
                        body.length > 0
                                ? HttpRequest.BodyPublishers.ofByteArray(body)
                                : HttpRequest.BodyPublishers.noBody());

        // Forward safe request headers; drop hop-by-hop and any client-supplied identity.
        Enumeration<String> names = request.getHeaderNames();
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            String lower = name.toLowerCase();
            if (HOP_BY_HOP.contains(lower) || lower.equals("authorization") || lower.startsWith("x-fusion-")) {
                continue;
            }
            upstream.header(name, request.getHeader(name));
        }
        // Inject the verified identity the backend is configured to trust.
        upstream.header("X-Fusion-User", user);
        upstream.header("X-Fusion-Workspace-Id", user);
        if (!gatewaySecret.isBlank()) {
            upstream.header("X-Gateway-Secret", gatewaySecret);
        }

        HttpResponse<InputStream> upstreamResponse;
        try {
            upstreamResponse = http.send(upstream.build(), HttpResponse.BodyHandlers.ofInputStream());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            response.sendError(HttpServletResponse.SC_GATEWAY_TIMEOUT, "Upstream interrupted");
            return;
        } catch (IOException e) {
            response.sendError(HttpServletResponse.SC_BAD_GATEWAY, "Backend unavailable");
            return;
        }

        response.setStatus(upstreamResponse.statusCode());
        for (Map.Entry<String, List<String>> entry : upstreamResponse.headers().map().entrySet()) {
            String lower = entry.getKey().toLowerCase();
            if (HOP_BY_HOP.contains(lower)) {
                continue;
            }
            for (String value : entry.getValue()) {
                response.addHeader(entry.getKey(), value);
            }
        }
        // Never buffer NDJSON / streaming responses.
        response.setHeader("X-Accel-Buffering", "no");

        try (InputStream in = upstreamResponse.body(); OutputStream out = response.getOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                out.flush();
            }
        }
    }
}
