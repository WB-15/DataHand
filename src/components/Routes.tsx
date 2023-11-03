import { createStackNavigator, HeaderBackButton, TransitionPresets } from '@react-navigation/stack';
import { ExplorationScreen } from '@components/pages/exploration/ExplorationScreen';
import { SettingsScreen } from '@components/pages/settings/SettingsScreen';
import { ServiceSelectionScreen } from '@components/pages/sources/service-wizard/ServiceSelectionScreen';
import React, { useMemo } from 'react';
import { Platform } from 'react-native';

export type RootStackParamList = {
  Exploration: undefined,
  Settings: undefined
}

export type SettingsSteckParamList = {
  Main: undefined,
  ServiceWizardModal: undefined
}

const Stack = createStackNavigator()

const SettingsNavigator = () => {

  const screenOptions = useMemo(() => ({
    ...TransitionPresets.SlideFromRightIOS,
    headerStatusBarHeight: Platform.OS === 'ios' ? 4 : 0
  }), [])

  return <Stack.Navigator initialRouteName="Main"
    screenOptions={screenOptions}>
    <Stack.Screen
      name="Main"
      component={SettingsScreen}
      options={(route) => ({
        title: 'Settings',
        headerBackTitle: 'Back',
        headerLeft: () => <HeaderBackButton onPress={route.navigation.goBack} />
      })} />
    <Stack.Screen
      name="ServiceWizardModal"
      component={ServiceSelectionScreen}
      options={{
        title: "Select Service",
        headerBackTitle: "Back"
      }} />
  </Stack.Navigator>
}

const screenOptions = Platform.OS === 'ios' ?  TransitionPresets.ModalPresentationIOS : TransitionPresets.ModalTransition

export default () => {
  return <Stack.Navigator initialRouteName="Exploration" headerMode='none'
    screenOptions={screenOptions}>
    <Stack.Screen
      name="Exploration"
      options={{ headerShown: false }}
      component={ExplorationScreen}
    />
    <Stack.Screen
      name="Settings"
      component={SettingsNavigator}
    />

  </Stack.Navigator>
}
