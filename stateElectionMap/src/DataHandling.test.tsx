import { loadAllData, ElectoralVoteDataUtils, Utils } from './DataHandling';
import fs from "fs";
import path from "path";

test('data looks reasonable', async () => {
    setupFetchMock();
    const data = await loadAllData();
    // sigh, there are territories in here
    expect(data.stateInfos.codeToStateName.size).toBeGreaterThanOrEqual(51);
    expect(data.electionData.get(2016).nationalDAdvantage).toBeCloseTo(2.1, 2);
});

test('calculate electoral votes by state correctly', async () => {
    setupFetchMock();
    const data = await loadAllData();
    const knownTXValues : Array<[number, number]> = [[1972, 26], [1976, 26], [1980, 26], [1984, 29], [1988, 29], [1992, 32], [1996, 32], [2000, 32], [2004, 34], [2008, 34], [2012, 38], [2016, 38], [2020, 38]];
    for (let [year, evs] of knownTXValues) {
        const actualEvs = ElectoralVoteDataUtils.getElectoralVotesForState(data.electoralVoteData, "TX", year);
        // assert on the year here so it's clear what year failed.  Is there a better way to do this?
        expect([year, evs]).toStrictEqual([year, actualEvs]);
    }
});

test('calculate electoral vote totals', async () => {
    setupFetchMock();
    const data = await loadAllData();
    // This ignores faithless electors, fwiw
    const knownDRValues : Array<[number, number, number]> = [
        [1972, 17, 521],
        [1976, 297, 241],
        [1980, 49, 489],
        [1984, 13, 525],
        [1988, 112, 426],
        [1992, 370, 168],
        [1996, 379, 159],
        [2000, 267, 271],
        [2004, 252, 286],
        [2008, 365, 173],
        [2012, 332, 206],
        [2016, 232, 306]
    ];
    for (let [year, d, r] of knownDRValues) {
        const actualEvs = ElectoralVoteDataUtils.getDAndRElectoralVotes(data.electoralVoteData, data.electionData, year);
        expect([year, actualEvs.dElectoralVotes, actualEvs.rElectoralVotes]).toStrictEqual([year, d, r]);
    }
});

test('textFromDAdvantage', () => {
    expect(Utils.textFromDAdvantage(0)).toEqual("Even");
    expect(Utils.textFromDAdvantage(1)).toEqual("D+1.0%");
    expect(Utils.textFromDAdvantage(0.3)).toEqual("D+0.3%");
    expect(Utils.textFromDAdvantage(0.9)).toEqual("D+0.9%");
    expect(Utils.textFromDAdvantage(2.5)).toEqual("D+2.5%");
    expect(Utils.textFromDAdvantage(12.0)).toEqual("D+12.0%");
    expect(Utils.textFromDAdvantage(-1)).toEqual("R+1.0%");
    expect(Utils.textFromDAdvantage(-0.3)).toEqual("R+0.3%");
    expect(Utils.textFromDAdvantage(-0.9)).toEqual("R+0.9%");
    expect(Utils.textFromDAdvantage(-2.5)).toEqual("R+2.5%");
    expect(Utils.textFromDAdvantage(-12.0)).toEqual("R+12.0%");
});

test('dAdvantageFromVotes', () => {
    expect(Utils.dAdvantageFromVotes({dCount: 100, rCount: 150, stateCode: "TX", totalCount: 250})).toEqual(-20);
    expect(Utils.dAdvantageFromVotes({dCount: 100, rCount: 150, stateCode: "TX", totalCount: 250}, 0)).toEqual(-20);
    expect(Utils.dAdvantageFromVotes({dCount: 100, rCount: 150, stateCode: "TX", totalCount: 250}, -10)).toEqual(-10);
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