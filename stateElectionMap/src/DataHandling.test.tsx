import { loadAllData, DataCollection } from './DataHandling';
import fs from "fs";
import path from "path";

test('data loads without alerts', async () => {
    jest.setTimeout(30000);
    setupFetchMock();
    let alerts = [];
    window.alert = s => alerts.push(s);
    const data = await loadAllData();
    if (alerts.length > 0) {
        fail(`got ${alerts.length} alerts, first one is ${alerts[0]}`);
    }
    // sigh, there are territories in here
    expect(data.stateInfos.codeToStateName.size).toBeGreaterThanOrEqual(51);
    //TODO more
});

function setupFetchMock() {
  // @ts-ignore
  window.fetch = async (info, init) => {
      const url = info;
      const filePath = path.join(__dirname, "../public/", url);
      //console.log(filePath); // data/us-state-names.tsv
      // could probably do this in a promise or something
      // This trim() call is annoying, but sometimes the files have leading spaces in the header?
      const data : string = fs.readFileSync(filePath, "utf8").trim();
      //console.log(data);
      return Promise.resolve({
          status: 200,
          statusText: "OK",
          type: "basic",
          url: filePath,
          redirected: false,
          ok: true,
          text: () => Promise.resolve(data)});
  }
}