import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';
import _ from 'lodash';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { isUndefined } from 'util';

export interface MapDateSliderProps {
    // Exactly one of this and yearsPerTick should be defined (the other should be undefined)
    ticksPerYear: number,
    // Exactly one of this and ticksPerYear should be defined (the other should be undefined)
    yearsPerTick: number,
    startDate: MapDate,
    endDate: MapDate,
    currentDate: MapDate
}

export interface MapDate {
    year: number,
    endMonth: number
}

class MapDateSlider extends Component<MapDateSliderProps, {}> {
    monthChangePerTick() {
        if (isUndefined(this.props.ticksPerYear)) {
            return this.props.yearsPerTick * 12;
        }
        else {
            return 12 / this.props.ticksPerYear;
        }
    }
    sliderIndexToMapDate(sliderIndex: number) {
        let newMonth = this.props.startDate.endMonth + this.monthChangePerTick() * sliderIndex;
        return { year: this.props.startDate.year + Math.floor(newMonth / 12), endMonth: newMonth % 12 };
    }
    mapDateToSliderIndex(mapDate: MapDate) {
        let yearDifference = mapDate.year - this.props.startDate.year;
        let monthDifference = mapDate.endMonth - this.props.startDate.endMonth;
        let totalMonthDifference = 12 * yearDifference + monthDifference;
        return totalMonthDifference / this.monthChangePerTick();
    }
    onSliderChange = (value) => {
        //TODO
        this.setState({ year: value });
    }
    render() {
        // https://react-component.github.io/slider/examples/slider.html
        return (
            <div style={{ width: 500 }} className="centerFixedWidth">
                <Slider min={0} max={this.mapDateToSliderIndex(this.props.endDate)} step={1} value={this.mapDateToSliderIndex(this.props.currentDate)} onChange={this.onSliderChange} />
                <div>
                    <Button>Play</Button>
                </div>
            </div>
        );
    }
}
