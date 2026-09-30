/// <reference types="vite/client" />

declare module 'react-plotly.js' {
  import { Component } from 'react';
  import Plotly from 'plotly.js-dist-min';

  interface PlotParams {
    data: Plotly.Data[];
    layout?: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
    style?: React.CSSProperties;
  }

  class Plot extends Component<PlotParams> {}
  export default Plot;
}

declare module 'plotly.js-dist-min' {
  const Plotly: typeof import('plotly.js');
  export default Plotly;
}
