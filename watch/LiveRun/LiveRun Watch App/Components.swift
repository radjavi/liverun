import SwiftUI

let primaryColor = Color(red: 1.0, green: 0.41, blue: 0.0)

enum UnitSystem {
    case metric, imperial

    static var current: UnitSystem {
        Locale.current.measurementSystem == .metric ? .metric : .imperial
    }

    var distanceUnit: String { self == .metric ? "km" : "mi" }
    var paceUnit: String { self == .metric ? "/km" : "/mi" }
    var metersPerUnit: Double { self == .metric ? 1000.0 : 1609.344 }

    func distance(meters: Double) -> Double { meters / metersPerUnit }
    func pace(minPerKm: Double) -> Double { self == .metric ? minPerKm : minPerKm * 1.60934 }
}

struct PrimaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .medium, design: .monospaced))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(primaryColor)
                .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

struct OutlineButton: View {
    let title: String
    var color: Color = Color(white: 0.35)
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, design: .monospaced))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(color)
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.white.opacity(0.15), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

struct DestructiveButton: View {
    let title: String
    var compact: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .medium, design: .monospaced))
                .foregroundColor(.red)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color.red.opacity(0.15))
                .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

struct StatRow: View {
    let label: String
    let value: String
    var unit: String = ""
    var compact: Bool = false

    var body: some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .tracking(1.5)
                .foregroundColor(.secondary)
                .padding(.top, compact ? 2 : 6)
            Spacer()
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value)
                    .font(.system(size: compact ? 20 : 28, design: .monospaced).monospacedDigit())
                if value != "\u{2014}" && !unit.isEmpty {
                    Text(unit)
                        .font(.system(size: compact ? 12 : 11, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}
