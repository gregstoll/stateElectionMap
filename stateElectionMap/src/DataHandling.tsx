import * as d3 from 'd3';
import _ from 'lodash';

export interface StateName {
    code: string,
    id: number,
    name: string
};

const cleanStateName = (d : any) : StateName => ({
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

export const MIN_YEAR = 1996;
export const MAX_YEAR = 2016;
export const YEAR_STEP = 4;

export interface ElectionData {
    [year: number]: Map<string, ElectionStateResult>
};

export interface DataCollection {
    usTopoJson: any,
    stateNames: StateName[],
    electionData: ElectionData
};

export const loadAllData = async () : Promise<DataCollection> => {
    let usPromise = d3.json('data/us.json');
    let stateNamesPromise = d3.tsv('data/us-state-names.tsv', cleanStateName);
    let electionDataPromises = {};
    for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
        electionDataPromises[year] = d3.csv('data/electionResults/' + year + '.csv', cleanElectionResults);
    }
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
    return {
        usTopoJson: us,
        stateNames: stateNames,
        electionData: electionData
    };
};
