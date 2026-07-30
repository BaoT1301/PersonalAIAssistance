package studio.fusionai.gateway.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Reads a Bearer JWT, validates it, and populates the SecurityContext with the
 * authenticated username. Instantiated in SecurityConfig (not a @Component) so
 * it is not double-registered in the servlet filter chain.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwt;

    public JwtAuthFilter(JwtService jwt) {
        this.jwt = jwt;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                String username = jwt.validateAndGetSubject(header.substring(7));
                var auth = new UsernamePasswordAuthenticationToken(
                        username, null, AuthorityUtils.NO_AUTHORITIES);
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception ignored) {
                // Invalid or expired token -> request stays unauthenticated.
            }
        }
        chain.doFilter(request, response);
    }
}
