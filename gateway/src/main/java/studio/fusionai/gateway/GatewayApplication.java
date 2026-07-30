package studio.fusionai.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * FusionAI API gateway. Terminates authentication (JWT) and per-user rate
 * limiting, then reverse-proxies /api/** to the FastAPI backend, injecting a
 * verified identity header the backend can trust.
 */
@SpringBootApplication
public class GatewayApplication {
    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
