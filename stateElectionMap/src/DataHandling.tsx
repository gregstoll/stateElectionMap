import * as d3 from 'd3';
import _ from 'lodash';

const VALIDATE_DATA = process.env.NODE_ENV !== "production";

function getD3Url(path: string): string{
    if (process.env.NODE_ENV !== "production") {
        return process.env.PUBLIC_URL + '/' + path;
    }
    return path;
}

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
export const MAX_YEAR = 2020;
export const YEAR_STEP = 4;

const MIN_ELECTORAL_VOTE_YEAR = 1971;
const MAX_ELECTORAL_VOTE_YEAR = 2011;
const ELECTORAL_VOTE_YEAR_STEP = 10;

export type ElectionData = Map<number, ElectionYearData>;
export type ElectoralVoteData = Array<[number, Map<string, number>]>;
export type MinVotesToChangeResultData = Map<number, Array<string>>;

export interface ElectionYearData {
    stateResults: Map<string, ElectionStateResult>,
    districtResults: Map<string, Array<ElectionStateResult>>,
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
    public static isFullStateResult(stateData: ElectionStateResult): boolean {
        return stateData.stateCode.length === 2;
    }
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
    //TODO - add test
    public static getStateOrDistrictResult(yearData: ElectionYearData, stateOrDistrictCode: string): ElectionStateResult {
        if (stateOrDistrictCode.length === 2) {
            return yearData.stateResults.get(stateOrDistrictCode);
        }
        const stateCode = stateOrDistrictCode.substring(0, 2);
        const districtResults = yearData.districtResults.get(stateCode);
        const index = parseInt(stateOrDistrictCode.substring(2)) - 1;
        return districtResults[index];
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
    public static getElectoralVotesForStateOrDistrict(data: ElectoralVoteData, stateOrDistrictCode: string, year: number): number {
        if (stateOrDistrictCode.length > 2) {
            return 1;
        }
        const electoralVoteData = this.getElectoralVoteDataForYear(data, year);
        return electoralVoteData.get(stateOrDistrictCode);
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
    private static getTotalDAndRElectoralVotesFromResults(stateResults: Array<ElectionStateResultWithElectoralVotes>, districtResults: Map<string, Array<ElectionStateResult>>, year: number): TotalElectoralVoteResult {
        let dElectoralVotes = 0, rElectoralVotes = 0;
        let stateDWon = new Map<string, boolean>();
        for (let result of stateResults) {
            const dWonState = result.dCount > result.rCount;
            if (dWonState) {
                dElectoralVotes += result.electoralVotes;
            }
            else {
                rElectoralVotes += result.electoralVotes;
            }
            const stateDistrictResults = districtResults.get(result.stateCode);
            if (stateDistrictResults !== undefined){
                for (let districtResult of stateDistrictResults) {
                    const dWonDistrict = districtResult.dCount > districtResult.rCount;
                    if (dWonDistrict != dWonState) {
                        if (dWonDistrict) {
                            dElectoralVotes += 1;
                            rElectoralVotes -= 1;
                        }
                        else {
                            dElectoralVotes -= 1;
                            rElectoralVotes += 1;
                        }
                    }
                }
            }
        }
        //TODO - remove this (and year parameter)
        switch(year) {
            case 2008:
                // NE
                dElectoralVotes += 1;
                rElectoralVotes -= 1;
                break;
        }
        return {dElectoralVotes: dElectoralVotes, rElectoralVotes: rElectoralVotes};
    }
    public static getTotalDAndRElectoralVotes(electoralVoteData: ElectoralVoteData, electionData: ElectionData, year: number): TotalElectoralVoteResult {
        const results = this.getDAndRElectoralVotes(electoralVoteData, electionData, year, StateSortingOrder.None);
        return this.getTotalDAndRElectoralVotesFromResults(results, electionData.get(year).districtResults, year);
    }
}

function validateData(year: number, stateData: ElectionStateResult, stateInfos: StateInfos): void {
    if (!stateInfos.codeToStateName.has(stateData.stateCode)) {
        if (!stateInfos.codeToStateName.has(stateData.stateCode.substring(0, 2))) {
            throw `invalid state code: ${year} ${stateData.stateCode}`;
        }
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
function validateDistrictData(year: number, districtData: Map<string, ElectionStateResult[]>, stateData: Map<string, ElectionStateResult>, stateInfos: StateInfos): void {
    let a = Array.from(districtData.entries());
    for (let [stateCode, districtResults] of a) {
        if (!stateInfos.codeToStateName.has(stateCode)) {
            throw `invalid state code for district: ${year} ${stateCode}`;
        }
        let dVotes = 0, rVotes = 0, totalVotes = 0;
        for (let result of districtResults) {
            if (result === undefined) {
                throw `missing district result found: ${year} ${stateCode}`;
            }
            dVotes += result.dCount;
            rVotes += result.rCount;
            totalVotes += result.totalCount;
        }
        const stateVotes = stateData.get(stateCode);
        if (Math.abs(dVotes - stateVotes.dCount) > 0.01 * stateVotes.totalCount) {
            throw `mismatch in D count for districts: ${year} ${stateCode} districts: ${dVotes} state: ${stateVotes.dCount}`;
        }
        if (Math.abs(rVotes - stateVotes.rCount) > 0.01 * stateVotes.totalCount) {
            throw `mismatch in R count for districts: ${year} ${stateCode} districts: ${rVotes} state: ${stateVotes.rCount}`;
        }
        if (Math.abs(totalVotes - stateVotes.totalCount) > 0.01 * stateVotes.totalCount) {
            throw `mismatch in total count for districts: ${year} ${stateCode} districts: ${totalVotes} state: ${stateVotes.totalCount}`;
        }
        // TODO - validate correct number of districts somewhere (in a test?)
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
    let stateNamesPromise = d3.tsv(getD3Url('data/us-state-names.tsv'), cleanStateName);
    const stateNames = await stateNamesPromise;
    // Weird way to check for errors
    if (stateNames.columns.length != 3) {
        throw "Failed to load state names data!";
    }
    const stateInfos = makeStateInfos(stateNames);

    let electionDataPromises = {};
    for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
        electionDataPromises[year] = d3.csv(getD3Url('data/electionResults/' + year + '.csv'), cleanElectionResults);
    }
    let electionData = new Map<number, ElectionYearData>();
    for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
        let data: ElectionStateResult[] = await electionDataPromises[year];
        let electionYearData: ElectionYearData = {
            stateResults: new Map<string, ElectionStateResult>(),
            districtResults: new Map<string, Array<ElectionStateResult>>(),
            nationalDAdvantage: undefined
        };
        data.forEach(stateResult => {
            if (VALIDATE_DATA) {
                validateData(year, stateResult, stateInfos);
            }
            if (Utils.isFullStateResult(stateResult)) {
                electionYearData.stateResults.set(stateResult.stateCode, stateResult);
            } else {
                const rawStateCode = stateResult.stateCode.substring(0, 2);
                const districtIndex = parseInt(stateResult.stateCode.substring(2), 10);
                if (districtIndex === undefined || districtIndex === 0) {
                    throw `Invalid district code for ${year} for ${stateResult.stateCode}`;
                }
                let existingDistricts = electionYearData.districtResults.get(rawStateCode);
                if (existingDistricts === undefined) {
                    existingDistricts = [];
                }
                // districtIndex is 1 indexed
                while (existingDistricts.length < districtIndex) {
                    existingDistricts.push(undefined);
                }
                existingDistricts[districtIndex - 1] = stateResult;
                electionYearData.districtResults.set(rawStateCode, existingDistricts);
            }
        });
        if (VALIDATE_DATA) {
            validateDistrictData(year, electionYearData.districtResults, electionYearData.stateResults, stateInfos);
        }
        setNationalDAdvantage(electionYearData);
        if (electionYearData.stateResults.size != 51) {
            throw `Invalid data for year ${year}, got ${electionYearData.stateResults.size} stateResults: ${Array.from(electionYearData.stateResults.keys())}`;
        }
        electionData.set(year, electionYearData);
    }
    let electoralVotePromises = {};
    for (let year = MIN_ELECTORAL_VOTE_YEAR; year <= MAX_ELECTORAL_VOTE_YEAR; year += ELECTORAL_VOTE_YEAR_STEP) {
        electoralVotePromises[year] = d3.csv(getD3Url('data/electoralVotes/' + year + '.csv'), cleanElectoralVoteResults);
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
    let minVotesJson = await d3.json(getD3Url('data/min_votes_to_change_result.json'));
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
