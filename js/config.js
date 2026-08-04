window.LINEUP_LEAGUES = Object.freeze({
  fp: Object.freeze({
    id: "fp",
    name: "PianginaCUP",
    label: "Fanta Premier",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1qCSKkMUZ6W_-_OG8qjTYEQTwF4aPqgtg3XjOGqphRHRDlnFynozJsC0t6WeFjY8XCXjr-R1ZVaww/pub?gid=556989324&single=true&output=csv",
    leagueData: Object.freeze({
      standingsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSE2UP5Dh4Syl3yW__nqfh6OAG7CpR4ZzBCZxDK3d9SmQeHX6YbdtsYCSsOfYh0F7RzjYV49LQKVFNe/pub?gid=0&single=true&output=csv",
      standingsFallbackUrl: "/data/fp/classifica.csv",
      teamProfilesUrl: "/data/fp/teams.json",
      regolamentoDocUrl: ""
    }),
    identity: Object.freeze({
      id: "fp",
      logo: "assets/identity/fp-logo.png",
      favicon: "/fp/favicon.svg?v=8",
      faviconType: "image/svg+xml",
      appleTouchIcon: "/fp/apple-touch-icon.png?v=5"
    }),
    theme: {
      primary: "#7c3aed",
      primaryLight: "#a855f7",
      primaryBg: "#f5f0ff",
      primaryBorder: "#ede9fe",
      background: "#f8f7ff"
    }
  }),

  pd: Object.freeze({
    id: "pd",
    name: "LaLigaCUP",
    label: "Fanta Liga",
    flag: "🇪🇸",
    csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlE8BNQI1bOPsOlg2aO7TTHr0RpJD9rCj_EP3QRpsBho6D3s_ZCtmMibhbjx0Ehc5jexbagbf_t9j0/pub?gid=1583604307&single=true&output=csv",
    leagueData: Object.freeze({
      standingsCsvUrl: "",
      standingsFallbackUrl: "/data/pd/classifica.csv",
      teamProfilesUrl: "/data/pd/teams.json",
      regolamentoDocUrl: ""
    }),
    identity: Object.freeze({
      id: "pd",
      logo: "assets/identity/pd-logo.png",
      favicon: "/pd/favicon.svg?v=8",
      faviconType: "image/svg+xml",
      appleTouchIcon: "/pd/apple-touch-icon.png?v=5"
    }),
    theme: {
      primary: "#b91c1c",
      primaryLight: "#ef4444",
      primaryBg: "#fff1f2",
      primaryBorder: "#fecdd3",
      background: "#fffafa"
    }
  })
});
