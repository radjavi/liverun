import Foundation
import SwiftUI
import Combine
import EFQRCode

struct DeviceCodeResponse: Codable {
    let deviceCode: String
    let userCode: String
    let verificationUri: String
    let verificationUriComplete: String
    let interval: Int
    let expiresIn: Int

    enum CodingKeys: String, CodingKey {
        case deviceCode = "device_code"
        case userCode = "user_code"
        case verificationUri = "verification_uri"
        case verificationUriComplete = "verification_uri_complete"
        case interval
        case expiresIn = "expires_in"
    }
}

struct TokenResponse: Codable {
    let accessToken: String?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case error
    }
}

struct SessionResponse: Codable {
    let user: SessionUser

    struct SessionUser: Codable {
        let name: String
        let displayUsername: String?
    }
}

@MainActor
class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var userCode: String?
    @Published var verificationUrl: String?
    @Published var qrCodeImage: CGImage?
    @Published var isPolling = false
    @Published var displayName: String?
    @Published var username: String?

    private let baseURL = Config.apiBaseURL
    private let clientId = "liverun-watch"
    private let tokenKey = "liverun_bearer_token"
    private let nameKey = "liverun_display_name"
    private let usernameKey = "liverun_username"

    var bearerToken: String? {
        KeychainHelper.load(key: tokenKey)
    }

    init() {
        let hasToken = KeychainHelper.load(key: tokenKey) != nil
        isAuthenticated = hasToken
        displayName = KeychainHelper.load(key: nameKey)
        username = KeychainHelper.load(key: usernameKey)
    }

    func requestDeviceCode() async {
        guard let url = URL(string: "\(baseURL)/api/auth/device/code") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["client_id": clientId]
        request.httpBody = try? JSONEncoder().encode(body)

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(DeviceCodeResponse.self, from: data)
            userCode = response.userCode
            verificationUrl = response.verificationUriComplete
            generateQRCode(from: response.verificationUriComplete)
            await pollForToken(deviceCode: response.deviceCode, interval: response.interval, expiresIn: response.expiresIn)
        } catch {
            print("Failed to request device code: \(error)")
        }
    }

    private func pollForToken(deviceCode: String, interval: Int, expiresIn: Int) async {
        guard let url = URL(string: "\(baseURL)/api/auth/device/token") else { return }

        isPolling = true
        var pollInterval = TimeInterval(interval)
        let deadline = Date().addingTimeInterval(TimeInterval(expiresIn))

        while Date() < deadline && isPolling {
            try? await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            let body: [String: String] = [
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": deviceCode,
                "client_id": clientId,
            ]
            request.httpBody = try? JSONEncoder().encode(body)

            do {
                let (data, _) = try await URLSession.shared.data(for: request)
                let response = try JSONDecoder().decode(TokenResponse.self, from: data)

                if let token = response.accessToken {
                    KeychainHelper.save(key: tokenKey, value: token)
                    await fetchUserInfo(token: token)
                    isAuthenticated = true
                    isPolling = false
                    userCode = nil
                    qrCodeImage = nil
                    return
                }

                if let error = response.error {
                    switch error {
                    case "authorization_pending":
                        continue
                    case "slow_down":
                        pollInterval += 5
                    case "access_denied", "expired_token":
                        isPolling = false
                        userCode = nil
                        qrCodeImage = nil
                        return
                    default:
                        isPolling = false
                        return
                    }
                }
            } catch {
                print("Token poll failed: \(error)")
            }
        }

        isPolling = false
        userCode = nil
        verificationUrl = nil
        qrCodeImage = nil
    }

    func signOut() {
        KeychainHelper.delete(key: tokenKey)
        KeychainHelper.delete(key: nameKey)
        KeychainHelper.delete(key: usernameKey)
        isAuthenticated = false
        displayName = nil
        username = nil
        userCode = nil
        qrCodeImage = nil
    }

    private func fetchUserInfo(token: String) async {
        guard let url = URL(string: "\(baseURL)/api/auth/get-session") else { return }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let session = try JSONDecoder().decode(SessionResponse.self, from: data)
            displayName = session.user.name
            KeychainHelper.save(key: nameKey, value: session.user.name)
            if let displayUsername = session.user.displayUsername {
                username = displayUsername
                KeychainHelper.save(key: usernameKey, value: displayUsername)
            }
        } catch {
            print("Failed to fetch user info: \(error)")
        }
    }

    private func generateQRCode(from string: String) {
        guard let generator = try? EFQRCode.Generator(string, style: .basic(params: EFStyleBasicParams())) else { return }
        guard let image = (try? generator.toImage(width: 180))?.cgImage else { return }
        qrCodeImage = image
    }
}
