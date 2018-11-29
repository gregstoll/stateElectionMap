import * as d3 from 'd3';
import _ from 'lodash';

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

export const MIN_YEAR = 1992;
export const MAX_YEAR = 2016;
export const YEAR_STEP = 4;

export interface ElectionData {
    [year: number]: Map<string, ElectionStateResult>
};

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

export const loadAllData = async (): Promise<DataCollection> => {
    //TODO error handling
    let usPromise = d3.json('data/us.json');
    let stateNamesPromise = d3.tsv('data/us-state-names.tsv', cleanStateName);
    let electionDataPromises = {};
    for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
        electionDataPromises[year] = d3.csv('data/electionResults/' + year + '.csv', cleanElectionResults);
    }
    let cartogramPromise = getCartogramAsync();
    let electionData = {};
    for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
        let data: ElectionStateResult[] = await electionDataPromises[year];
        electionData[year] = new Map<string, ElectionStateResult>();
        data.forEach(stateResult => {
            electionData[year].set(stateResult.stateCode, stateResult);
        });
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
