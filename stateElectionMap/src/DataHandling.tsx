import * as d3 from 'd3';
import _ from 'lodash';

const VALIDATE_DATA = process.env.NODE_ENV !== "production";

export interface StateName {
    code: string,
    id: number,
    name: string
};

export interface StateInfos {
    codeToStateName: Map<string, StateName>,
    idToStateName: Map<number, StateName>
};

const cleanStateName = (d: any): StateName => ({
    code: d.code,
    id: Number(d.id),
    name: d.name
});

export interface ElectionStateResult {
    stateCode: string,
    dCount: number,
    rCount: number,
    totalCount: number
};

const cleanElectionResults = (d: any): ElectionStateResult => {
    const dKey = _.find(Object.keys(d), key => key.endsWith("(D)"));
    const rKey = _.find(Object.keys(d), key => key.endsWith("(R)"));
    return {
        stateCode: d["State"],
        dCount: Number(d[dKey].replace(/,/g, '')),
        rCount: Number(d[rKey].replace(/,/g, '')),
        totalCount: Number(d["Total"].replace(/,/g, ''))
    };
};

const cleanElectoralVoteResults = (d: any): [string, number] => {
    return [d["State"], Number(d["Electoral Votes"].replace(/,/g, ''))];
};

export const MIN_YEAR = 1972;
export const MAX_YEAR = 2016;
export const YEAR_STEP = 4;

const MIN_ELECTORAL_VOTE_YEAR = 1971;
const MAX_ELECTORAL_VOTE_YEAR = 2011;
const ELECTORAL_VOTE_YEAR_STEP = 10;

export type ElectionData = Map<number, ElectionYearData>;
export type ElectoralVoteData = Array<[number, Map<string, number>]>;
export type MinVotesToChangeResultData = Map<number, Array<string>>;

export interface ElectionYearData {
    stateResults: Map<string, ElectionStateResult>,
    nationalDAdvantage: number
}

export interface DataCollection {
    stateInfos: StateInfos,
    electionData: ElectionData,
    electoralVoteData: ElectoralVoteData,
    minVotesToChangeResultData: MinVotesToChangeResultData
};

export interface TotalElectoralVoteResult {
    dElectoralVotes: number,
    rElectoralVotes: number
}

export enum StateSortingOrder {
    None,
    RawVotes,
    Percentage
}

export interface ElectionStateResultWithElectoralVotes extends ElectionStateResult {
    electoralVotes: number
}

export class Utils {
    public static dAdvantageFromVotes(stateData: ElectionStateResult, baselineDAdvantage = 0): number {
        let dAdvantage = ((stateData.dCount - stateData.rCount) * 100.0) / stateData.totalCount;
        return dAdvantage - baselineDAdvantage;
    }

    public static colorFromDAdvantage(dAdvantage: number): string {
        // http://colorbrewer2.org/?type=diverging&scheme=RdBu&n=11
        const _colors =
            ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'];

        // 5 red, 5 blue (don't use middle one)
        const increment = 3;
        if (dAdvantage < -4 * increment) {
            return _colors[0];
        }
        if (dAdvantage < -3 * increment) {
            return _colors[1];
        }
        if (dAdvantage < -2 * increment) {
            return _colors[2];
        }
        if (dAdvantage < -1 * increment) {
            return _colors[3];
        }
        if (dAdvantage < 0) {
            return _colors[4];
        }

        if (dAdvantage > 4 * increment) {
            return _colors[10];
        }
        if (dAdvantage > 3 * increment) {
            return _colors[9];
        }
        if (dAdvantage > 2 * increment) {
            return _colors[8];
        }
        if (dAdvantage > increment) {
            return _colors[7];
        }
        return _colors[6];
    }

    public static textFromDAdvantage(dAdvantage: number): string {
        if (dAdvantage > 0) {
            return "D+" + (dAdvantage).toFixed(1) + "%";
        }
        if (dAdvantage < 0) {
            return "R+" + (-1 * dAdvantage).toFixed(1) + "%";
        }
        return "Even";
    }
}

export class DataUtils {
    public static getNumberOfVotesToChangeWinner(stateResult: ElectionStateResult): number {
        // + 1 to change the winner (instead of a D/R tie)
        return Math.abs(stateResult.dCount - stateResult.rCount) + 1;
    }
    public static getElectoralVoteDataForYear(data: ElectoralVoteData, year: number): Map<string, number> {
        if (year < data[0][0]) {
            throw `Year ${year} is too early for data, which has earliest year ${data[0][0]}`;
        }
        let dataIndex = 0;
        while ((dataIndex + 1) < data.length && data[dataIndex + 1][0] < year) {
            dataIndex += 1;
        }
        return data[dataIndex][1];
    }
    public static getClosestStateByPercentage(electionData: ElectionData, year: number) : ElectionStateResult {
        const allStateResults = electionData.get(year).stateResults;
        // just start with something
        let lowestRatio = 1;
        let lowestStateResult = undefined;
        const a = Array.from(allStateResults.entries());
        for (let [_, stateResult] of a) {
            const ratio = Math.abs(stateResult.dCount - stateResult.rCount) / stateResult.totalCount;
            if (ratio < lowestRatio) {
                lowestRatio = ratio;
                lowestStateResult = stateResult;
            }
        }
        return lowestStateResult;
    }
    public static getElectoralVotesForState(data: ElectoralVoteData, stateCode: string, year: number): number {
        const electoralVoteData = this.getElectoralVoteDataForYear(data, year);
        return electoralVoteData.get(stateCode);
    }
    public static getTippingPointState(electoralVoteData: ElectoralVoteData, electionData: ElectionData, year: number) : ElectionStateResultWithElectoralVotes {
        let voteData = this.getDAndRElectoralVotes(electoralVoteData, electionData, year, StateSortingOrder.Percentage);
        const totalElectoralVotes = voteData.reduce((prev, curValue, curIndex) => prev + curValue.electoralVotes, 0);
        const decidingVote = (totalElectoralVotes % 2 === 0) ? (totalElectoralVotes / 2 + 1) : Math.ceil(totalElectoralVotes / 2);
        const totalDElectoralVotes = voteData.reduce((prev, curValue, curIndex) => prev + ((curValue.dCount > curValue.rCount) ? curValue.electoralVotes : 0), 0);
        // start from the strongest state for the winning party
        if (totalDElectoralVotes < decidingVote) {
            voteData = voteData.reverse()
        }
        let votesSoFar = 0;
        // Note that this ignores split electoral votes for NE and ME.  This doesn't
        // affect the results, at least in the years we cover.
        for (let i = 0; i < voteData.length; ++i) {
            votesSoFar += voteData[i].electoralVotes;
            if (votesSoFar >= decidingVote) {
                return voteData[i];
            }
        }
        throw "Couldn't find tipping point state!";
    }
    // Sorted with most D states first
    public static getDAndRElectoralVotes(electoralVoteData: ElectoralVoteData, electionData: ElectionData, year: number, sortBy: StateSortingOrder): Array<ElectionStateResultWithElectoralVotes> {
        const electoralVoteYearData = this.getElectoralVoteDataForYear(electoralVoteData, year);
        const allStateResults = electionData.get(year).stateResults;
        //TODO - performance https://stackoverflow.com/questions/37699320/iterating-over-typescript-map
        const a = Array.from(electoralVoteYearData.entries());
        let results: Array<ElectionStateResultWithElectoralVotes> = [];
        for (let [stateCode, electoralVotes] of a) {
            const stateResults = allStateResults.get(stateCode);
            results.push({...stateResults, electoralVotes: electoralVotes});
        }
        switch (sortBy) {
            case StateSortingOrder.RawVotes:
                results = results.sort((a, b) => ((b.dCount - b.rCount) - (a.dCount - a.rCount)));
                break;
            case StateSortingOrder.Percentage:
                results = results.sort((a, b) => ((b.dCount - b.rCount)/b.totalCount - (a.dCount - a.rCount)/a.totalCount));
                break;
        }
        return results;
    }
    private static getTotalDAndRElectoralVotesFromResults(stateResults: Array<ElectionStateResultWithElectoralVotes>, year: number): TotalElectoralVoteResult {
        let dElectoralVotes = 0, rElectoralVotes = 0;
        for (let result of stateResults) {
            if (result.dCount > result.rCount) {
                dElectoralVotes += result.electoralVotes;
            }
            else {
                rElectoralVotes += result.electoralVotes;
            }
        }
        // adjustments for split electoral votes, sigh
        switch(year) {
            case 2008:
                // NE
                dElectoralVotes += 1;
                rElectoralVotes -= 1;
                break;
            case 2016:
                // ME
                dElectoralVotes -= 1;
                rElectoralVotes += 1;
                break;
        }
        return {dElectoralVotes: dElectoralVotes, rElectoralVotes: rElectoralVotes};
    }
    public static getTotalDAndRElectoralVotes(electoralVoteData: ElectoralVoteData, electionData: ElectionData, year: number): TotalElectoralVoteResult {
        const results = this.getDAndRElectoralVotes(electoralVoteData, electionData, year, StateSortingOrder.None);
        return this.getTotalDAndRElectoralVotesFromResults(results, year);
    }
}

function validateData(year: number, stateData: ElectionStateResult, stateInfos: StateInfos): void {
    if (!stateInfos.codeToStateName.has(stateData.stateCode)) {
        throw `invalid state code: ${year} ${stateData.stateCode}`;
    }
    if (stateData.dCount + stateData.rCount > stateData.totalCount) {
        throw `total is too low: ${year} ${stateData.stateCode}`;
    }
    if ((stateData.rCount + stateData.dCount) * 2 < stateData.totalCount) {
        throw `too many third-party votes ${year} ${stateData.stateCode}`;
    }
    if (stateData.dCount > 10 * stateData.rCount) {
        if (!(stateData.stateCode == "DC" && stateData.dCount < 30 * stateData.rCount)) {
            throw `too many d's: ${year} ${stateData.stateCode}`;
        }
    }
    if (stateData.rCount > 10 * stateData.dCount) {
        throw `too many r's: ${year} ${stateData.stateCode}`;
    }
}

function validateElectoralData(year: number, stateVotes: [string, number], stateInfos: StateInfos): void {
    if (!stateInfos.codeToStateName.has(stateVotes[0])) {
        throw `invalid state code: ${year} ${stateVotes[0]}`;
    }
    if (!(stateVotes[1] > 0 && stateVotes[1] < 70)) {
        throw `invalid number of votes: ${year} ${stateVotes[0]} ${stateVotes[1]}`;
    }
}

//TODO - write tests for this method
export const loadAllData = async (): Promise<DataCollection> => {
    let stateNamesPromise = d3.tsv('data/us-state-names.tsv', cleanStateName);
    const stateNames = await stateNamesPromise;
    // Weird way to check for errors
    if (stateNames.columns.length != 3) {
        throw "Failed to load state names data!";
    }
    const stateInfos = makeStateInfos(stateNames);

    let electionDataPromises = {};
    for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
        electionDataPromises[year] = d3.csv('data/electionResults/' + year + '.csv', cleanElectionResults);
    }
    let electionData = new Map<number, ElectionYearData>();
    for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
        let data: ElectionStateResult[] = await electionDataPromises[year];
        let electionYearData: ElectionYearData = {
            stateResults: new Map<string, ElectionStateResult>(),
            nationalDAdvantage: undefined
        };
        data.forEach(stateResult => {
            if (VALIDATE_DATA) {
                validateData(year, stateResult, stateInfos);
            }
            electionYearData.stateResults.set(stateResult.stateCode, stateResult);
        });
        setNationalDAdvantage(electionYearData);
        if (electionYearData.stateResults.size != 51) {
            throw `Invalid data for year ${year}, got ${electionYearData.stateResults.size} stateResults: ${Array.from(electionYearData.stateResults.keys())}`;
        }
        electionData.set(year, electionYearData);
    }
    let electoralVotePromises = {};
    for (let year = MIN_ELECTORAL_VOTE_YEAR; year <= MAX_ELECTORAL_VOTE_YEAR; year += ELECTORAL_VOTE_YEAR_STEP) {
        electoralVotePromises[year] = d3.csv('data/electoralVotes/' + year + '.csv', cleanElectoralVoteResults);
    }
    let electoralVoteData : ElectoralVoteData = [];
    for (let year = MIN_ELECTORAL_VOTE_YEAR; year <= MAX_ELECTORAL_VOTE_YEAR; year += ELECTORAL_VOTE_YEAR_STEP) {
        let data : [string, number][] = await electoralVotePromises[year];
        let yearVoteData = new Map<string, number>();
        let totalElectoralVotes = 0;
        data.forEach(stateVotes => {
            if (VALIDATE_DATA) {
                validateElectoralData(year, stateVotes, stateInfos);
            }
            yearVoteData.set(stateVotes[0], stateVotes[1]);
            totalElectoralVotes += stateVotes[1];
        });
        if (yearVoteData.size != 51) {
            throw "Invalid electoral data for year " + year;
        }
        // This can vary between years, but for all our data 538 is the right number
        if (VALIDATE_DATA) {
            if (totalElectoralVotes != 538) {
                throw `Wrong number of electoral votes ${year} ${totalElectoralVotes}`;
            }
        }
        electoralVoteData.push([year, yearVoteData]);
    }
    // Sigh, could use fetch() here but d3 does the path resolving like we're expecting
    let minVotesJson = await d3.json('data/min_votes_to_change_result.json');
    let minVotesData = new Map<number, Array<string>>();
    for (let year of Object.keys(minVotesJson)) {
        minVotesData.set(parseInt(year, 10), minVotesJson[year]);
    }
    return {
        stateInfos: stateInfos,
        electionData: electionData,
        electoralVoteData: electoralVoteData,
        minVotesToChangeResultData: minVotesData
    };
};

function makeStateInfos(names: StateName[]): StateInfos {
    let stateInfos: StateInfos = { codeToStateName: new Map<string, StateName>(), idToStateName: new Map<number, StateName>() };
    for (let name of names) {
        stateInfos.codeToStateName.set(name.code, name);
        stateInfos.idToStateName.set(name.id, name);
    }
    return stateInfos;
}

function setNationalDAdvantage(electionYearData: ElectionYearData) {
    let dTotal = 0, rTotal = 0, allTotal = 0;
    //for (const Array.from(electionData.values()).forEach(value => {
    //for (const value of Array.from(electionData.values())) {
    //const values: any = electionData.values();
    //for (let [key, value] of Array.from(electionData)) {
    //TODO - performance https://stackoverflow.com/questions/37699320/iterating-over-typescript-map
    let a = Array.from(electionYearData.stateResults.entries());
    for (let [key, value] of a) {
        //for (let entry of Array.from(electionData.entries())) {
        //ugh this is so gross
        //for (let i = 0; i < values.length; ++i) {
        //const value = values[i];
        //let value = electionData[key];
        dTotal += value.dCount;
        rTotal += value.rCount;
        allTotal += value.totalCount;
    }
    electionYearData.nationalDAdvantage = ((dTotal - rTotal) * 100.0) / allTotal;
}
