/* eslint-disable react/no-unstable-nested-components */
import * as React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useColors } from './useColors'
import { Image } from 'react-native'
import { ViewScreen } from './screens/ViewScreen'
import { EvalScreen } from './screens/EvalScreen'

const map = require('./img/map.png')
const terminal = require('./img/terminal.webp')

const Tabs = createBottomTabNavigator()

export default function App() {
  const colors = useColors()
  return (
    <NavigationContainer>
      <Tabs.Navigator
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen
          name="View"
          component={ViewScreen}
          options={{
            tabBarLabel: 'View',
            tabBarIcon: ({ size, color }) => (
              <Image
                source={map}
                tintColor={color}
                style={{ width: size, height: size }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="Eval"
          component={EvalScreen}
          options={{
            tabBarLabel: 'Eval',
            tabBarIcon: ({ size, color }) => (
              <Image
                source={terminal}
                tintColor={color}
                style={{ width: size, height: size }}
              />
            ),
          }}
        />
      </Tabs.Navigator>
    </NavigationContainer>
  )
}
