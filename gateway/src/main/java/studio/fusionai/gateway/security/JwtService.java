package studio.fusionai.gateway.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/** Issues and verifies HS256 JWTs. */
@Service
public class JwtService {

    private final SecretKey key;
    private final long expirySeconds;

    public JwtService(@Value("${fusionai.jwt.secret}") String secret,
                      @Value("${fusionai.jwt.expiry-minutes}") long expiryMinutes) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("fusionai.jwt.secret must be at least 32 characters");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirySeconds = expiryMinutes * 60;
    }

    public String generate(String username) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(username)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(expirySeconds)))
                .signWith(key)
                .compact();
    }

    /** Returns the token subject (username), or throws if the token is invalid/expired. */
    public String validateAndGetSubject(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }
}
