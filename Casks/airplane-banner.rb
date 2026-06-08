cask "airplane-banner" do
  version "0.1.0"
  sha256 :no_check # tracks the latest GitHub release; pin a checksum per version if you tap this

  arch arm: "arm64", intel: "x64"

  url "https://github.com/AdelinaLipsa/airplane-banner/releases/download/v#{version}/Airplane-Banner-#{version}-#{arch}.dmg",
      verified: "github.com/AdelinaLipsa/airplane-banner/"
  name "Airplane Banner"
  desc "Flies a banner across your screen before Google Calendar meetings"
  homepage "https://github.com/AdelinaLipsa/airplane-banner"

  # The app auto-updates itself via electron-updater.
  auto_updates true
  depends_on macos: ">= :big_sur"

  app "Airplane Banner.app"

  zap trash: [
    "~/Library/Application Support/airplane-banner",
    "~/Library/Application Support/Airplane Banner",
    "~/Library/Preferences/com.adelina.airplanebanner.plist",
    "~/Library/Logs/Airplane Banner",
  ]
end
