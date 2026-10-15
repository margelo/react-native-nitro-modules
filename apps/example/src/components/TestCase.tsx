import { Button, Platform, StyleSheet, Text, View } from 'react-native'
import type { InAppTest, InAppTestResult } from '../harness/inAppHarness'
import { useColors } from '../useColors'

export type TestCaseState = 'idle' | 'running' | InAppTestResult['status']

const STATE_LABELS: Record<TestCaseState, string> = {
  idle: '📱 Click to run',
  running: '⏳ Running',
  passed: '✅ Passed',
  failed: '❌ Failed',
  skipped: '⏭️ Skipped',
  todo: '📝 Todo',
}

interface TestCaseProps {
  test: InAppTest
  result: InAppTestResult | 'running' | undefined
  onRunPressed: () => void
  isOdd: boolean
}

export function TestCase({
  test,
  result,
  onRunPressed,
  isOdd,
}: TestCaseProps): React.ReactElement {
  const colors = useColors()
  const state: TestCaseState =
    result == null ? 'idle' : result === 'running' ? 'running' : result.status
  const finished = typeof result === 'object' ? result : undefined
  return (
    <View
      style={[
        styles.testCase,
        { backgroundColor: isOdd ? colors.oddBackground : colors.background },
      ]}
    >
      <View style={styles.testBox}>
        <Text style={[styles.testName, { color: colors.text }]}>
          {test.name}
        </Text>
        <Text style={[styles.ancestors, { color: colors.textSecondary }]}>
          {test.ancestorTitles.join(' › ')}
        </Text>
        <View style={styles.smallVSpacer} />
        <Text style={[styles.testStatus, { color: colors.textSecondary }]}>
          {STATE_LABELS[state]}
          {finished != null ? ` (${finished.durationMs}ms)` : ''}
        </Text>
        {finished?.message != null && (
          <Text
            style={[styles.message, { color: colors.text }]}
            numberOfLines={20}
          >
            {finished.message}
          </Text>
        )}
      </View>
      <View style={styles.flex} />
      <Button title="Run" onPress={onRunPressed} />
    </View>
  )
}

const styles = StyleSheet.create({
  testCase: {
    width: '100%',
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  testBox: {
    flexShrink: 1,
    flexDirection: 'column',
  },
  testName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ancestors: {
    fontSize: 12,
  },
  testStatus: {
    fontSize: 14,
  },
  message: {
    fontSize: 12,
    marginTop: 5,
    fontFamily: Platform.select({
      ios: 'Menlo',
      macos: 'Menlo',
      android: 'monospace',
    }),
  },
  smallVSpacer: {
    height: 5,
  },
  flex: { flex: 1 },
})
