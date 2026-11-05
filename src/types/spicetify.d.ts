declare namespace Spicetify {
  interface PlayerTrack {
    uri: string;
    uid?: string;
    name: string;
    album: {
      uri: string;
      name: string;
      images: Array<{ url: string; height?: number; width?: number }>;
    };
    artists: Array<{ uri: string; name: string }>;
    metadata?: Record<string, string>;
    duration: {
      milliseconds: number;
    };
  }

  interface PlayerData {
    item?: PlayerTrack;
    is_paused: boolean;
    is_playing?: boolean;
    progress: number;
    timestamp?: number;
    speed?: number;
  }

  interface TatumItem {
    start: number;
    duration: number;
    confidence: number;
  }

  interface SectionItem {
    start: number;
    duration: number;
    loudness: number;
    tempo: number;
    tempo_confidence: number;
    key: number;
    key_confidence: number;
    mode: number;
    mode_confidence: number;
    time_signature: number;
    time_signature_confidence: number;
  }

  interface SegmentItem {
    start: number;
    duration: number;
    loudness_start: number;
    loudness_max: number;
    loudness_max_time: number;
    loudness_end?: number;
    pitches: number[];
    timbre: number[];
  }

  interface AudioAnalysis {
    bars: TatumItem[];
    beats: TatumItem[];
    tatums: TatumItem[];
    sections: SectionItem[];
    segments: SegmentItem[];
    track: {
      duration: number;
      loudness: number;
      tempo: number;
      tempo_confidence: number;
      time_signature: number;
      key: number;
      mode: number;
    };
  }

  namespace Player {
    function getProgress(): number;
    function getDuration(): number;
    function isPlaying(): boolean;
    const data: PlayerData;
    function addEventListener(event: 'songchange' | 'onplaypause' | 'onprogress' | string, callback: (event?: any) => void): void;
    function removeEventListener(event: 'songchange' | 'onplaypause' | 'onprogress' | string, callback: (event?: any) => void): void;
    function seek(ms: number): void;
    const getPlaybackSpeed: (() => number) | undefined;
  }

  namespace Playbar {
    class Button {
      constructor(
        label: string,
        icon: string,
        onClick: (button: Button) => void,
        disabled?: boolean,
        active?: boolean
      );
      label: string;
      icon: string;
      element: HTMLElement;
      active: boolean;
      disabled: boolean;
      tippy?: any;
      register(): void;
      deregister(): void;
    }
  }

  namespace Topbar {
    class Button {
      constructor(
        label: string,
        icon: string,
        onClick: (button: Button) => void,
        disabled?: boolean,
        rightPosition?: boolean
      );
      label: string;
      icon: string;
      element: HTMLElement;
      disabled: boolean;
      tippy?: any;
    }
  }

  namespace CosmosAsync {
    function get(url: string, headers?: Record<string, string>): Promise<any>;
    function post(url: string, body?: any, headers?: Record<string, string>): Promise<any>;
    function put(url: string, body?: any, headers?: Record<string, string>): Promise<any>;
    function del(url: string, headers?: Record<string, string>): Promise<any>;
  }

  namespace URI {
    function fromString(uri: string): {
      id?: string;
      type?: string;
      toURI?: () => string;
    };
  }

  namespace colorExtractor {
    function get(uri: string): Promise<Record<string, string>>;
  }
}

declare const Spicetify: typeof Spicetify;
