import { loadAllData, ElectoralVoteDataUtils, Utils, StateSortingOrder } from './DataHandling';
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
        const actualEvs = ElectoralVoteDataUtils.getTotalDAndRElectoralVotes(data.electoralVoteData, data.electionData, year);
        expect([year, actualEvs.dElectoralVotes, actualEvs.rElectoralVotes]).toStrictEqual([year, d, r]);
    }
});

test('getDAndRElectoralVotes', async () => {
    setupFetchMock();
    const data = await loadAllData();
    const results = ElectoralVoteDataUtils.getDAndRElectoralVotes(data.electoralVoteData, data.electionData, 1972, StateSortingOrder.None);
    expect(results.length).toEqual(51);
    expect(results.reduce((prev, curValue, curIndex) => curValue.electoralVotes + prev, 0)).toEqual(538);
    {
        // Pick a reasonably close election to test sorting
        const resultsByRawVotes = ElectoralVoteDataUtils.getDAndRElectoralVotes(data.electoralVoteData, data.electionData, 2000, StateSortingOrder.RawVotes);
        for (let i = 0; i < 50; ++i) {
            expect(resultsByRawVotes[i].dCount - resultsByRawVotes[i].rCount).toBeGreaterThan(resultsByRawVotes[i+1].dCount - resultsByRawVotes[i+1].rCount);
        }
    }
    {
        // Pick a reasonably close election to test sorting
        const resultsByPercentage = ElectoralVoteDataUtils.getDAndRElectoralVotes(data.electoralVoteData, data.electionData, 2000, StateSortingOrder.Percentage);
        for (let i = 0; i < 50; ++i) {
            expect((resultsByPercentage[i].dCount - resultsByPercentage[i].rCount)/resultsByPercentage[i].totalCount).
                toBeGreaterThan((resultsByPercentage[i+1].dCount - resultsByPercentage[i+1].rCount)/resultsByPercentage[i+1].totalCount);
        }
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

test('colorFromDAdvantage', () => {
    // honestly not a great test, but /shrug
    expect(Utils.colorFromDAdvantage(-100)).toEqual('#67001f');
    expect(Utils.colorFromDAdvantage(-12.1)).toEqual('#67001f');
    expect(Utils.colorFromDAdvantage(-11.9)).toEqual('#b2182b');
    expect(Utils.colorFromDAdvantage(-9.1)).toEqual('#b2182b');
    expect(Utils.colorFromDAdvantage(-8.9)).toEqual('#d6604d');
    expect(Utils.colorFromDAdvantage(-6.1)).toEqual('#d6604d');
    expect(Utils.colorFromDAdvantage(-5.9)).toEqual('#f4a582');
    expect(Utils.colorFromDAdvantage(-3.1)).toEqual('#f4a582');
    expect(Utils.colorFromDAdvantage(-2.9)).toEqual('#fddbc7');
    expect(Utils.colorFromDAdvantage(-0.1)).toEqual('#fddbc7');
    expect(Utils.colorFromDAdvantage(0.1)).toEqual('#d1e5f0');
    expect(Utils.colorFromDAdvantage(2.9)).toEqual('#d1e5f0');
    expect(Utils.colorFromDAdvantage(3.1)).toEqual('#92c5de');
    expect(Utils.colorFromDAdvantage(5.9)).toEqual('#92c5de');
    expect(Utils.colorFromDAdvantage(6.1)).toEqual('#4393c3');
    expect(Utils.colorFromDAdvantage(8.9)).toEqual('#4393c3');
    expect(Utils.colorFromDAdvantage(9.1)).toEqual('#2166ac');
    expect(Utils.colorFromDAdvantage(11.9)).toEqual('#2166ac');
    expect(Utils.colorFromDAdvantage(12.1)).toEqual('#053061');
    expect(Utils.colorFromDAdvantage(100)).toEqual('#053061');
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