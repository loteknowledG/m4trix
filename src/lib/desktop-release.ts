const GITHUB_REPO = "loteknowledG/m4trix";
export const DESKTOP_RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;

type GithubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

type GithubRelease = {
  tag_name?: string;
  assets?: GithubReleaseAsset[];
};

/** Latest Windows NSIS installer from GitHub Releases (auto-update enabled builds). */
export async function getLatestDesktopInstallerUrl(): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const release = (await res.json()) as GithubRelease;
    const asset = (release.assets || []).find(
      (item) => typeof item.name === "string" && /^m4trix-Setup-.*\.exe$/i.test(item.name),
    );
    const url = asset?.browser_download_url?.trim();
    return url || null;
  } catch {
    return null;
  }
}

export async function openDesktopInstallerDownload(): Promise<"downloaded" | "releases-page"> {
  const installerUrl = await getLatestDesktopInstallerUrl();
  if (installerUrl) {
    window.open(installerUrl, "_blank", "noopener,noreferrer");
    return "downloaded";
  }
  window.open(DESKTOP_RELEASES_PAGE, "_blank", "noopener,noreferrer");
  return "releases-page";
}
