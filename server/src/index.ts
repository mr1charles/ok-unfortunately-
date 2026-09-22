import { createApp } from "./app.js";
import { env } from "./env.js";
import { startAuctionCloser } from "./jobs/auctionCloser.js";

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Pixel Estates API listening on http://localhost:${env.port} [${env.nodeEnv}]`);
  startAuctionCloser();
});
