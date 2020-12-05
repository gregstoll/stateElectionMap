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
    let dKey = _.find(Object.keys(d), key => key.endsWith("(D)"));
    let rKey = _.find(Object.keys(d), key => key.endsWith("(R)"));
    return {
        stateCode: d[""],
        dCount: Number(d[dKey].replace(/,/g, '')),
        rCount: Number(d[rKey].replace(/,/g, '')),
        totalCount: Number(d["Total"].replace(/,/g, ''))
    };
};

const cleanElectoralVoteResults = (d: any): [string, number] => {
    return [d[""], Number(d["Electoral Votes"].replace(/,/g, ''))];
};

export const MIN_YEAR = 1972;
export const MAX_YEAR = 2016;
export const YEAR_STEP = 4;

const MIN_ELECTORAL_VOTE_YEAR = 1971;
const MAX_ELECTORAL_VOTE_YEAR = 1971;
const ELECTORAL_VOTE_YEAR_STEP = 10;

export type ElectionData = Map<number, ElectionYearData>;

export interface ElectionYearData {
    stateResults: Map<string, ElectionStateResult>,
    nationalDAdvantage: number
}

export interface DataCollection {
    stateInfos: StateInfos,
    electionData: ElectionData,
    electoralVoteData: Array<[number, Map<string, number>]>
};

function validateData(year: number, stateData: ElectionStateResult, stateInfos: StateInfos): void {
    if (!stateInfos.codeToStateName.has(stateData.stateCode)) {
        alert(`invalid state code: ${year} ${stateData.stateCode}`);
    }
    if (stateData.dCount + stateData.rCount > stateData.totalCount) {
        alert(`total is too low: ${year} ${stateData.stateCode}`);
    }
    if ((stateData.rCount + stateData.dCount) * 2 < stateData.totalCount) {
        alert(`too many third-party votes ${year} ${stateData.stateCode}`);
    }
    if (stateData.dCount > 10 * stateData.rCount) {
        /*if (!(stateData.stateCode == "DC" && stateData.dCount < 30 * stateData.rCount)) {*/
            alert(`too many d's: ${year} ${stateData.stateCode}`);
        /*}*/
    }
    if (stateData.rCount > 10 * stateData.dCount) {
        alert(`too many r's: ${year} ${stateData.stateCode}`);
    }
}

function validateElectoralData(year: number, stateVotes: [string, number], stateInfos: StateInfos): void {
    if (!stateInfos.codeToStateName.has(stateVotes[0])) {
        alert(`invalid state code: ${year} ${stateVotes[0]}`);
    }
    if (!(stateVotes[1] > 0 && stateVotes[1] < 70)) {
        alert(`invalid number of votes: ${year} ${stateVotes[0]} ${stateVotes[1]}`);
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
            throw "Invalid data for year " + year;
        }
        electionData.set(year, electionYearData);
    }
    let electoralVotePromises = {};
    for (let year = MIN_ELECTORAL_VOTE_YEAR; year <= MAX_ELECTORAL_VOTE_YEAR; year += ELECTORAL_VOTE_YEAR_STEP) {
        electoralVotePromises[year] = d3.csv('data/electoralVotes/' + year + '.csv', cleanElectoralVoteResults);
    }
    let electoralVoteData : Array<[number, Map<string, number>]> = [];
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
                alert(`Wrong number of electoral votes ${year} ${totalElectoralVotes}`);
            }
        }
        electoralVoteData.push([year, yearVoteData]);
    }
    return {
        stateInfos: stateInfos,
        electionData: electionData,
        electoralVoteData: electoralVoteData
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
