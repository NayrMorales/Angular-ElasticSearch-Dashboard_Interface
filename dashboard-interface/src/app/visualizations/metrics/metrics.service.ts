import { Injectable } from '@angular/core';

import { Elasticsearch } from '../../elasticsearch';

import { AggregationData } from '../../object-classes/aggregationData';
import { VisualizationObj } from '../../object-classes/visualizationObj';

@Injectable()
export class MetricsService {

	constructor( private _elasticCli: Elasticsearch ) {}

	saveMetric(visualizationObj: VisualizationObj): void {
		this._elasticCli.saveVisualization(visualizationObj);
	}

	getAggsResults(index: string, aggs: AggregationData[]): PromiseLike<any>{
		return this._elasticCli.request(index, aggs).then(response =>
			this._getResults(response, aggs)
		);
	}

	private _getResults(response: any, aggs: AggregationData[]): any[] {
		let aggByIdMap = this._getaggByIdMap(aggs);
		let results = [];
		for(let i=0; i<aggs.length; i++){
			results.push(this._getAggResult(response, aggs[i]));
		}
		return results;
	}

	private _getAggResult(response: any, agg: AggregationData): any {
		let aggResponse = response.aggregations[agg.id];
		switch(agg.type){
			case 'count':
				return this._getCountResult(response);
			case 'avg':
			case 'sum':
			case 'min':
			case 'max':
			case 'cardinality':
				return this._getSimpleResult(aggResponse, agg);
			case 'median':
				return this._getMedianResult(aggResponse, agg);
			case 'extended_stats':
				return this._getStdResult(aggResponse, agg);
			case 'percentiles':
				return this._getPercentilesResult(aggResponse, agg);
			case 'percentile_ranks':
				return this._getPercentileRanksResult(aggResponse, agg);
			case 'top_hits':
				return this._getTopHitsResult(aggResponse, agg);
		}
	}

	private _getaggByIdMap(aggs: AggregationData[]): Map<string, AggregationData> {
		let aggByIdMap = new Map<string, AggregationData>();
		for(let i=0; i<aggs.length; i++){
			aggByIdMap.set(aggs[i].id, aggs[i]);
		}
		return aggByIdMap;
	}

	private _getCountResult(response: any): any[]{
		return [{
				label: 'Count',
				result: response.hits.total
		}];
	}

	// This method is avilable for aggs: avg, sum, min, max, cardinality
	private _getSimpleResult(aggResponse: any, agg: AggregationData): any[] {
		return [{
			label: ('Average ' + agg.params.field),
			result: aggResponse.value
		}];
	}

	private _getMedianResult(aggResponse: any, agg: AggregationData): any[]{
		return [{
					label: ('50th percentile of ' + agg.params.field),
					result: aggResponse.values['50.0']
		}]
	}

	private _getStdResult(aggResponse: any, agg: AggregationData): any[]{
		return [
			{
				label: ('Lower Standard Deviation of ' + agg.params.field),
				result: aggResponse.std_deviation_bounds.lower
			},
			{
				label: ('Upper Standard Deviation of ' + agg.params.field),
				result: aggResponse.std_deviation_bounds.upper
			}
		]
	}

	private _getPercentilesResult(aggResponse: any, agg: AggregationData): any[]{
		let results = [];
		for(let percentile in aggResponse.values){
			results.push(
				{
					label: (percentile + 'th percentile of ' + agg.params.field),
					result: Math.round(aggResponse.values[percentile]*100)/100
				}
			);
		}
		return results;
	}

	private _getPercentileRanksResult(aggResponse: any, agg: AggregationData): any[]{
		let results = [];
		for(let percentile in aggResponse.values){
			results.push({
				label: (
					'Percentile rank ' + percentile + ' of "' + agg.params.field + '"'
				),
				result: Math.round(aggResponse.values[percentile]*100)/100
			});
		}
		return results;
	}

	private _getTopHitsResult(aggResponse: any, agg: AggregationData): any[]{
		let results = [];
		let hitsArr = aggResponse.hits.hits;
		let orderLabel = (agg.params.sortOrder==='asc') ? 'First' : 'Last';

		results.push({
			label: (orderLabel + ' ' + agg.params.size + ' ' + agg.params.field),
			result: this._getTopHitsResut(aggResponse, agg)
		});

		return results;
	}

	private _getTopHitsResut(aggResponse: any, agg: AggregationData): any{
		let hits = aggResponse.hits.hits;
		let selectedField =agg.params.field;
		let aggType = agg.params.aggregate;

		if(aggType==='Concatenate'){
			return this._getConcatenation(hits, selectedField);
		}else if(aggType==='Sum'){
			return this._getSummation(hits, selectedField);
		}else if(aggType==='Max'){
			return this._getMaximum(hits, selectedField);
		}else if(aggType==='Min'){
			return this._getMinimum(hits, selectedField);
		}else if(aggType==='Average'){
			return this._getAverage(hits, selectedField);
		}
		return null;
	}

	private _getConcatenation(hits: any[], selectedField: string): any{
		let concatenation = '';
		for(let i=0; i<hits.length; i++){
			concatenation += hits[i]._source[selectedField]
			if(i<(hits.length-1)) concatenation += ', '
		}
		return concatenation;
	}

	private _getSummation(hits: any[], selectedField: string): any{
		let sum = 0;
		for(let i=0; i<hits.length; i++){
			sum += hits[i]._source[selectedField];
		}
		return sum;
	}

	private _getMaximum(hits: any[], selectedField: string): any{
		let max = null;
		for(let i=0; i<hits.length; i++){
			let hitValue = hits[i]._source[selectedField];
			max = (!max || hitValue>max) ? hitValue : max;
		}
		return max;
	}

	private _getMinimum(hits: any[], selectedField: string): any{
		let min = null;
		for(let i=0; i<hits.length; i++){
			let hitValue = hits[i]._source[selectedField];
			min = (!min || hitValue<min) ? hitValue : min;
		}
		return min;
	}

	private _getAverage(hits: any[], selectedField: string): any{
		let sum = 0;
		for(let i=0; i<hits.length; i++){
			sum += hits[i]._source[selectedField];
		}
		let avg = (hits.length>0) ? sum/hits.length : 0;
		return avg;
	}
}
