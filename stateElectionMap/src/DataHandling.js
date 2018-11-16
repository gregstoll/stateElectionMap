import * as d3 from 'd3';
import _ from 'lodash';

const cleanUSStateName = (d) => ({
    code: d.code,
    id: Number(d.id),
    name: d.name
});

//TODO - probably can make the caller async-aware
export const loadAllData = async (callback = _.noop) => {
    let us = await d3.json('data/us.json');
    let usStateNames = await d3.tsv('data/us-state-names.tsv', cleanUSStateName);
	callback({
	    usTopoJson: us,
        usStateNames: usStateNames
	});
};
