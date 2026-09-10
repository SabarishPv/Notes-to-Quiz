const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const IconNotes = (p) => (
  <svg {...base} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6M9 9h1" />
  </svg>
);

export const IconUpload = (p) => (
  <svg {...base} {...p}>
    <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
);

export const IconLink = (p) => (
  <svg {...base} {...p}>
    <path d="M9.5 14.5 14.5 9.5" />
    <path d="M11 6.5 12.4 5a3.5 3.5 0 0 1 5 5L16 11.4" />
    <path d="M13 17.5 11.6 19a3.5 3.5 0 0 1-5-5L8 12.6" />
  </svg>
);

export const IconBolt = (p) => (
  <svg {...base} strokeWidth={2} {...p}>
    <path d="M13 2 3 14h7l-1 8 11-13h-7z" />
  </svg>
);

export const IconFolder = (p) => (
  <svg {...base} {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const IconLayers = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3 3 8l9 5 9-5z" />
    <path d="M3 13l9 5 9-5M3 18l9 5 9-5" />
  </svg>
);

export const IconPlus = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);

export const IconTrash = (p) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </svg>
);

export const IconShare = (p) => (
  <svg {...base} {...p}>
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

export const IconRefresh = (p) => (
  <svg {...base} {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
  </svg>
);

export const IconCheck = (p) => (
  <svg {...base} {...p}><path d="M20 6 9 17l-5-5" /></svg>
);

export const IconArrowRight = (p) => (
  <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export const IconChevronRight = (p) => (
  <svg {...base} {...p}><path d="m9 6 6 6-6 6" /></svg>
);

export const IconDots = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
  </svg>
);

export const IconSort = (p) => (
  <svg {...base} {...p}>
    <path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l3-3M17 20l-3-3" />
  </svg>
);
