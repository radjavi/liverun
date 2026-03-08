import SwiftUI

struct SummaryView: View {
    let summary: RunSummary
    let onDismiss: () -> Void
    private let units = UnitSystem.current

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 8) {
                    StatRow(label: "TIME", value: formatDuration(summary.duration), compact: true)
                    StatRow(label: "DISTANCE", value: String(format: "%.2f", units.distance(meters: summary.distanceMeters)), unit: units.distanceUnit, compact: true)
                    StatRow(label: "AVG PACE", value: summary.avgPace > 0 ? formatPace(units.pace(minPerKm: summary.avgPace)) : "\u{2014}", unit: units.paceUnit, compact: true)
                    StatRow(label: "CHEERS", value: "\(summary.cheerCount)", compact: true)
                }
                .padding()
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        onDismiss()
                    } label: {
                        Image(systemName: "xmark")
                    }
                }
            }
        }
    }

    private func formatDuration(_ seconds: TimeInterval) -> String {
        let h = Int(seconds) / 3600
        let m = (Int(seconds) % 3600) / 60
        let s = Int(seconds) % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%02d:%02d", m, s)
    }

    private func formatPace(_ minPerKm: Double) -> String {
        let mins = Int(minPerKm)
        let secs = Int((minPerKm - Double(mins)) * 60)
        return String(format: "%d:%02d", mins, secs)
    }
}
