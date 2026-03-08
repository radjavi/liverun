import SwiftUI

struct DeviceAuthView: View {
    @ObservedObject var authManager: AuthManager

    var body: some View {
        if authManager.userCode != nil || authManager.isPolling {
            ScrollView {
                VStack(spacing: 12) {
                    if let qrCode = authManager.qrCodeImage {
                        Image(decorative: qrCode, scale: 1.0)
                            .interpolation(.none)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 120, height: 120)
                            .cornerRadius(8)
                    }

                    if let code = authManager.userCode {
                        Text(code)
                            .font(.system(size: 20, weight: .bold, design: .monospaced))
                            .tracking(3)

                        Text("Scan QR or enter code at\n\(authManager.verificationUrl ?? "")")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    } else {
                        ProgressView()
                    }
                }
                .padding()
            }
        } else {
            VStack(spacing: 12) {
                Spacer()

                Text("LiveRun")
                    .font(.system(size: 20, weight: .bold, design: .monospaced))

                Text("Make your run more fun")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.secondary)

                Spacer()

                PrimaryButton(title: "Sign In") {
                    Task { await authManager.requestDeviceCode() }
                }
            }
            .padding()
        }
    }
}
