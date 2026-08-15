import { isAxiosError } from "axios";
import { useState } from "react";
import { setSimulationVisibility } from "../api/client";

interface ShareButtonProps {
  simulationId: string;
  isPublic: boolean;
  // Lets the parent (SimulatePage/HistoryPage) keep its own copy of the
  // result/summary in sync once the flag flips, so re-rendering elsewhere
  // (e.g. the history table) reflects it without a refetch.
  onVisibilityChange?: (isPublic: boolean) => void;
}

function shareUrlFor(simulationId: string): string {
  return `${window.location.origin}/share/${simulationId}`;
}

export default function ShareButton({ simulationId, isPublic: initialIsPublic, onVisibilityChange }: ShareButtonProps) {
  // Owns its own copy rather than reading the prop directly - the parent's
  // result/summary state usually isn't threaded back through after a PATCH,
  // so this is what keeps the button's own label correct immediately after
  // a click without every caller having to wire that up.
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrlFor(simulationId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy the link - copy it from the address it opens in instead");
    }
  }

  async function handleShare() {
    setLoading(true);
    setError(null);
    try {
      await setSimulationVisibility(simulationId, true);
      setIsPublic(true);
      onVisibilityChange?.(true);
      await copyLink();
    } catch (err) {
      setError(isAxiosError<{ detail?: string }>(err) ? err.response?.data?.detail ?? err.message : "Couldn't share this run");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnshare() {
    setLoading(true);
    setError(null);
    try {
      await setSimulationVisibility(simulationId, false);
      setIsPublic(false);
      onVisibilityChange?.(false);
    } catch (err) {
      setError(isAxiosError<{ detail?: string }>(err) ? err.response?.data?.detail ?? err.message : "Couldn't make this run private");
    } finally {
      setLoading(false);
    }
  }

  if (isPublic) {
    return (
      <div className="share-control">
        <button type="button" onClick={copyLink} className="secondary-button">
          {copied ? "Link copied!" : "Copy share link"}
        </button>
        <button type="button" onClick={handleUnshare} disabled={loading} className="link-button">
          {loading ? "Making private..." : "Make private"}
        </button>
        {error && <span className="error">{error}</span>}
      </div>
    );
  }

  return (
    <div className="share-control">
      <button type="button" onClick={handleShare} disabled={loading} className="secondary-button">
        {loading ? "Sharing..." : copied ? "Link copied!" : "Share"}
      </button>
      {error && <span className="error">{error}</span>}
    </div>
  );
}
