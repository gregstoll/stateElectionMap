import * as d3 from 'd3';
import _ from 'lodash';

const cleanUSStateName = (d) => ({
    code: d.code,
    id: Number(d.id),
    name: d.name
});

//TODO
const cleanElectionResults = d => ({
    stateCode: d[""],
    dCount: Number(d["Obama (D)"].replace(/,/g, '')),
    rCount: Number(d["Romney (R)"].replace(/,/g, ''))
});

const electionYears = [2012];

//TODO - probably can make the caller async-aware
export const loadAllData = async (callback = _.noop) => {
    //TODO - parallelize
    let us = await d3.json('data/us.json');
    let usStateNames = await d3.tsv('data/us-state-names.tsv', cleanUSStateName);
    let electionData = await d3.csv('data/electionResults/2012.csv', cleanElectionResults);
	callback({
	    usTopoJson: us,
        usStateNames: usStateNames,
        electionData: electionData
	});
};
