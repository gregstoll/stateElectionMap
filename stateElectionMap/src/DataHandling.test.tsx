import { loadAllData, DataCollection, ElectoralVoteDataUtils } from './DataHandling';
import fs from "fs";
import path from "path";

test('data looks reasonable', async () => {
    setupFetchMock();
    const data = await loadAllData();
    // sigh, there are territories in here
    expect(data.stateInfos.codeToStateName.size).toBeGreaterThanOrEqual(51);
    expect(data.electionData.get(2016).nationalDAdvantage).toBeCloseTo(2.1, 2);
});

test('calculate electoral votes correctly', async () => {
    setupFetchMock();
    const data = await loadAllData();
    const knownTXValues : Array<[number, number]> = [[1972, 26], [1976, 26], [1980, 26], [1984, 29], [1988, 29], [1992, 32], [1996, 32], [2000, 32], [2004, 34], [2008, 34], [2012, 38], [2016, 38], [2020, 38]];
    for (let [year, evs] of knownTXValues) {
        const actualEvs = ElectoralVoteDataUtils.getElectoralVotesForState(data.electoralVoteData, "TX", year);
        expect([year, actualEvs]).toStrictEqual([year, evs]);
    }
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