package studio.fusionai.gateway.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import studio.fusionai.gateway.security.JwtService;
import studio.fusionai.gateway.user.AppUser;
import studio.fusionai.gateway.user.UserRepository;

import java.security.Principal;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthController(UserRepository users, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    public record Credentials(
            @NotBlank @Size(min = 3, max = 64) String username,
            @NotBlank @Size(min = 8, max = 128) String password) {
    }

    public record AuthResponse(String token, String username) {
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody Credentials body) {
        if (users.existsByUsername(body.username())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }
        AppUser user = users.save(new AppUser(body.username(), encoder.encode(body.password())));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new AuthResponse(jwt.generate(user.getUsername()), user.getUsername()));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody Credentials body) {
        AppUser user = users.findByUsername(body.username())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        if (!encoder.matches(body.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return new AuthResponse(jwt.generate(user.getUsername()), user.getUsername());
    }

    @GetMapping("/me")
    public AuthResponse me(Principal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return new AuthResponse(null, principal.getName());
    }
}
