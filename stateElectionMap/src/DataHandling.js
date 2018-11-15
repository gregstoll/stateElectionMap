import * as d3 from 'd3';
import { queue } from 'd3-queue';
import _ from 'lodash';

const cleanUSStateName = (d) => ({
    code: d.code,
    id: Number(d.id),
    name: d.name
});

export const loadAllData = (callback = _.noop) => {
        //TODO - getting weird data here
        //.defer(d3.json, 'data/us.json')
    queue()
        .defer(d3.tsv, 'data/us-state-names.tsv') //, cleanUSStateName)
        .await(function (error, us, usStateNames) {
            //alert(us);
            callback({
                usTopoJson: us,
                usStateNames: usStateNames
            });
        });
};
