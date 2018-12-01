import * as d3 from 'd3';
import _ from 'lodash';

const VALIDATE_DATA = false;

export interface StateName {
    code: string,
    id: number,
    name: string
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

export const MIN_YEAR = 1984;
export const MAX_YEAR = 2016;
export const YEAR_STEP = 4;

export type ElectionData = Map<number, ElectionYearData>;

export interface ElectionYearData {
    stateResults: Map<string, ElectionStateResult>,
    nationalDAdvantage: number
}

export interface DataCollection {
    usTopoJson: any,
    cartogram: d3.Selection<HTMLElement, () => any, null, undefined>,
    stateNames: StateName[],
    electionData: ElectionData
};

const getCartogramAsync = async (): Promise<d3.Selection<HTMLElement, () => any, null, undefined>> => {
    const xml = await d3.xml('data/cartograms/fivethirtyeight.svg', { headers: new Headers({ "Content-Type": "image/svg+xml" }) });
    //TODO error handling
    return d3.select(xml.documentElement);
};

function validateData(year: number, stateData: ElectionStateResult): void {
    if (stateData.dCount + stateData.rCount > stateData.totalCount) {
        alert(`total is too low: ${year} ${stateData.stateCode}`);
    }
    if ((stateData.rCount + stateData.dCount) * 2 < stateData.totalCount) {
        alert(`too many third-party votes ${year} ${stateData.stateCode}`);
    }
    if (stateData.dCount > 10 * stateData.rCount) {
        if (!(stateData.stateCode == "DC" && stateData.dCount < 30 * stateData.rCount)) {
            alert(`too many d's: ${year} ${stateData.stateCode}`);
        }
    }
    if (stateData.rCount > 10 * stateData.dCount) {
        alert(`too many r's: ${year} ${stateData.stateCode}`);
    }
}

export const loadAllData = async (): Promise<DataCollection> => {
    //TODO error handling
    let usPromise = d3.json('data/us.json');
    let stateNamesPromise = d3.tsv('data/us-state-names.tsv', cleanStateName);
    let electionDataPromises = {};
    for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
        electionDataPromises[year] = d3.csv('data/electionResults/' + year + '.csv', cleanElectionResults);
    }
    let cartogramPromise = getCartogramAsync();
    let electionData = new Map<number, ElectionYearData>();
    for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
        let data: ElectionStateResult[] = await electionDataPromises[year];
        let electionYearData: ElectionYearData = {
            stateResults: new Map<string, ElectionStateResult>(),
            nationalDAdvantage: undefined
        };
        data.forEach(stateResult => {
            if (VALIDATE_DATA) {
                validateData(year, stateResult);
            }
            electionYearData.stateResults.set(stateResult.stateCode, stateResult);
        });
        setNationalDAdvantage(electionYearData);
        electionData.set(year, electionYearData);
    }
    let us = await usPromise;
    let stateNames = await stateNamesPromise;
    let cartogram = await cartogramPromise;
    return {
        usTopoJson: us,
        cartogram: cartogram,
        stateNames: stateNames,
        electionData: electionData
    };
};

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
        //TODO ugh this is so gross
        //for (let i = 0; i < values.length; ++i) {
        //const value = values[i];
        //let value = electionData[key];
        dTotal += value.dCount;
        rTotal += value.rCount;
        allTotal += value.totalCount;
    }
    electionYearData.nationalDAdvantage = ((dTotal - rTotal) * 100.0) / allTotal;
}
