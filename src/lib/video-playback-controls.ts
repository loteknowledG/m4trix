export type VideoPlaybackControls = {
  seek: (seconds: number) => void;
  pause: () => void;
  /** External embeds only — enable/disable manual timeline follow. */
  setTimelineFollow: (enabled: boolean) => void;
  isTimelineFollowEnabled: () => boolean;
  isTimelineFollowRunning: () => boolean;
};
