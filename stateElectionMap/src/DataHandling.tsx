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
    rCount: number
};

const cleanElectionResults = (d: any): ElectionStateResult => {
    let dKey = _.find(Object.keys(d), key => key.endsWith("(D)"));
    let rKey = _.find(Object.keys(d), key => key.endsWith("(R)"));
    return {
        stateCode: d[""],
        dCount: Number(d[dKey].replace(/,/g, '')),
        rCount: Number(d[rKey].replace(/,/g, ''))
    };
};

const electionYears = [2000, 2004, 2008, 2012, 2016];

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2016;
export const YEAR_STEP = 4;

export interface ElectionData {
    [year: number]: ElectionStateResult[]
};

export interface DataCollection {
    usTopoJson: any,
    stateNames: StateName[],
    electionData: ElectionData
};

export const loadAllData = async () : Promise<DataCollection> => {
    //TODO - parallelize
    let us = await d3.json('data/us.json');
    let stateNames = await d3.tsv('data/us-state-names.tsv', cleanStateName);
    let electionDataPromises = {};
    for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
        electionDataPromises[year] = d3.csv('data/electionResults/' + year + '.csv', cleanElectionResults);
    }
    let electionData = {};
    for (let i = 0; i < electionYears.length; ++i) {
        electionData[electionYears[i]] = await electionDataPromises[electionYears[i]];
    }
    return {
        usTopoJson: us,
        stateNames: stateNames,
        electionData: electionData
    };
};
