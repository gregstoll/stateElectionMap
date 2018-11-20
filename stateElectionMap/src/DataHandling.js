import * as d3 from 'd3';
import _ from 'lodash';

const cleanUSStateName = (d) => ({
    code: d.code,
    id: Number(d.id),
    name: d.name
});

const cleanElectionResults = d => {
    let dKey = _.find(Object.keys(d), key => key.endsWith("(D)"));
    let rKey = _.find(Object.keys(d), key => key.endsWith("(R)"));
    return {
        stateCode: d[""],
        dCount: Number(d[dKey].replace(/,/g, '')),
        rCount: Number(d[rKey].replace(/,/g, ''))
    };
};

const electionYears = [2008, 2012];

//TODO - probably can make the caller async-aware
export const loadAllData = async (callback = _.noop) => {
    //TODO - parallelize
    let us = await d3.json('data/us.json');
    let usStateNames = await d3.tsv('data/us-state-names.tsv', cleanUSStateName);
    let electionDataPromises = {};
    electionYears.forEach(value => {
        electionDataPromises[value] = d3.csv('data/electionResults/' + value + '.csv', cleanElectionResults);
    });
    let electionData = {}; //await d3.csv('data/electionResults/2012.csv', cleanElectionResults);
    for (let i = 0; i < electionYears.length; ++i) {
        electionData[electionYears[i]] = await electionDataPromises[electionYears[i]];
    }
	callback({
	    usTopoJson: us,
        usStateNames: usStateNames,
        electionData: electionData
	});
};
