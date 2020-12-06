import { loadAllData, DataCollection } from './DataHandling';
import fs from "fs";
import path from "path";

test('data loads without alerts', async () => {
    setupFetchMock();
    const data = await loadAllData();
    // sigh, there are territories in here
    expect(data.stateInfos.codeToStateName.size).toBeGreaterThanOrEqual(51);
    expect(data.electionData.get(2016).nationalDAdvantage).toBeCloseTo(2.1, 2);
});

function setupFetchMock() {
  // @ts-ignore
  window.fetch = async (info, init) => {
      const url = info as string;
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