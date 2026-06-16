const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://cyxcode.ai" : `https://${stage}.cyxcode.ai`,
  console: stage === "production" ? "https://cyxcode.ai/auth" : `https://${stage}.cyxcode.ai/auth`,
  email: "contact@cyxcode.ai",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/code3hr/cyxcode",
  discord: "https://cyxcode.ai/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
