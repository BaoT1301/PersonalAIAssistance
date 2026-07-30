package studio.fusionai.gateway.ratelimit;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory per-key token-bucket rate limiter (no Redis needed for a single
 * instance). Each key refills continuously toward its capacity.
 */
@Component
public class RateLimiter {

    private static final class Bucket {
        private final double capacity;
        private final double refillPerNano;
        private double tokens;
        private long lastRefillNanos;

        Bucket(double perMinute) {
            this.capacity = perMinute;
            this.tokens = perMinute;
            this.refillPerNano = perMinute / 60.0 / 1_000_000_000.0;
            this.lastRefillNanos = System.nanoTime();
        }

        synchronized boolean tryConsume() {
            long now = System.nanoTime();
            tokens = Math.min(capacity, tokens + (now - lastRefillNanos) * refillPerNano);
            lastRefillNanos = now;
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return true;
            }
            return false;
        }
    }

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    /** Returns true if a request is allowed for this key under the given per-minute limit. */
    public boolean allow(String key, double perMinute) {
        return buckets.computeIfAbsent(key, k -> new Bucket(perMinute)).tryConsume();
    }
}
