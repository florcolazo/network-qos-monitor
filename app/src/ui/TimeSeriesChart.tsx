import { matchFont } from '@shopify/react-native-skia';
import React from 'react';
import { Platform, Text, View } from 'react-native';
import { CartesianChart, Line, Scatter } from 'victory-native';
import { styles } from './components';
import { colors } from './theme';

const font = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
  fontSize: 10,
});

export interface Series {
  label: string;
  color: string;
}

/** Un punto con hasta dos series: `a` y `b`. */
export type ChartDatum = { t: number; a: number | null; b: number | null };

const KEYS = ['a', 'b'] as const;

const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Serie temporal (RF-06) con victory-native. El eje X es el timestamp de la medición. */
export function TimeSeriesChart({
  data,
  series,
  unit,
}: {
  data: ChartDatum[];
  series: [Series, Series];
  unit: string;
}) {
  const hasValues = data.some(d => d.a !== null || d.b !== null);
  if (data.length < 2 || !hasValues) {
    return <Text style={styles.muted}>Se necesitan al menos 2 mediciones con datos.</Text>;
  }

  return (
    <View>
      <View style={{ height: 200 }}>
        <CartesianChart
          data={data}
          xKey="t"
          yKeys={[...KEYS]}
          domainPadding={{ top: 12, bottom: 4, left: 8, right: 8 }}
          xAxis={{ font, tickCount: 4, formatXLabel: v => hhmm(Number(v)), labelColor: colors.muted, lineColor: colors.border }}
          yAxis={[{ font, tickCount: 5, labelColor: colors.muted, lineColor: colors.border }]}>
          {({ points }) =>
            KEYS.map((key, i) => (
              <React.Fragment key={key}>
                <Line points={points[key]} color={series[i].color} strokeWidth={2} connectMissingData />
                <Scatter points={points[key]} color={series[i].color} radius={2.5} />
              </React.Fragment>
            ))
          }
        </CartesianChart>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
        {series.map(s => (
          <Text key={s.label} style={[styles.muted, { color: s.color }]}>
            ● {s.label} ({unit})
          </Text>
        ))}
      </View>
    </View>
  );
}
