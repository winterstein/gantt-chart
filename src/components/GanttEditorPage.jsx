import React from 'react';
import ReactDOM from 'react-dom';

import SJTest, {assert} from 'sjtest';
import printer from '../utils/printer.js';
import C from '../C.js';


import Misc from './Misc';
import DataStore from '../plumbing/DataStore';

const GanttEditorPage = () => {
	let path = ['data','Chart','mychart'];
	let chart = DataStore.getValue(path);
	if ( ! chart) {
		try {
			chart = JSON.parse(localStorage.ganttChart) || {};
			DataStore.setValue(path, chart, false);	
		} catch(err) {
			console.error(err);
			chart = {};
		}
	}
	// auto save
	localStorage.ganttChart = JSON.stringify(chart);
	// <button onClick={ () => { localStorage.ganttChart = JSON.stringify(chart); } } >save</button>
	return (
	<div className='row'>
		<div className=''>
			<Misc.PropControl path={path} prop='text' type='textarea' rows={20} />			
		</div>
		<div>&nbsp;</div>
		<div className=''>
			<GanttChart chart={chart} />
		</div>
	</div>);
};

const GanttChart = ({chart}) => {
	let text = chart.text;
	let lines = text? text.split(/\n/) : [];
	let times = lines[0]? lines[0].split(/,/).map(bit => bit.trim()) : [];
	let timerow = times.map(t => <th key={t}>{t}</th>);
	let wpwidth = lines[1] || '20%';
	let rows = lines.slice(2).map(line => <GanttRow key={line} wpwidth={wpwidth} line={line} times={times} />);
	return (
		<table className='table table-bordered'>
			<thead></thead>
			<tbody>
				<tr><th>Work Package</th>{timerow}</tr>
				{rows}
			</tbody>
		</table>
	);
};

const GanttRow = ({line, times, wpwidth}) => {
	let bits = line.split(':');
	let wp = bits[0];
	wp = wp.replace('->', '→');
	let twidth = (80 / times.length)+'%';
	let ons = times.map(t => <td key={t} style={{width:twidth}} className={line.indexOf(t)===-1? '' : 'gantt-on'}></td>);
	return (<tr>
		<td style={{width:wpwidth}} dangerouslySetInnerHTML={{__html: wp}} />
		{ons}
	</tr>);
};

export default GanttEditorPage;
