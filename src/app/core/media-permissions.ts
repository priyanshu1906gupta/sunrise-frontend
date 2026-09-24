const LIVE_MEDIA: MediaStreamConstraints = {
  audio: true,
  video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
};

export async function requestLiveMedia(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(LIVE_MEDIA);
}

/** Prompt for camera + mic, then stop tracks so only the permission dialog runs. */
export async function preflightLiveMedia(): Promise<boolean> {
  try {
    const stream = await requestLiveMedia();
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}
