import React, { useCallback, useMemo, useState } from 'react'
import type { ImageLoadEventData, NativeSyntheticEvent } from 'react-native'
import { StyleSheet, ActivityIndicator, PermissionsAndroid, Platform, Image } from 'react-native'
import type { OnVideoErrorData, OnLoadData } from 'react-native-video'
import Video from 'react-native-video'
import { PressableOpacity } from 'react-native-pressable-opacity'
import IonIcon from 'react-native-vector-icons/Ionicons'
import { Alert } from 'react-native'
import { CameraRoll } from '@react-native-camera-roll/camera-roll'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useIsFocused } from '@react-navigation/core'
import { RootStackParamList } from '../../navigator'
import { StatusBarBlurBackground } from '../camera/statusBarBlurBackground'
import { useIsForeground } from '../camera/hooks/useIsForeground'
import { SAFE_AREA_PADDING } from '../camera/constants'
import styled from 'styled-components/native'

const requestSavePermission = async (): Promise<boolean> => {
    // On Android 13 and above, scoped storage is used instead and no permission is needed
    if (Platform.OS !== 'android' || Platform.Version >= 33) return true

    const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    if (permission == null) return false
    let hasPermission = await PermissionsAndroid.check(permission)
    if (!hasPermission) {
        const permissionRequestResult = await PermissionsAndroid.request(permission)
        hasPermission = permissionRequestResult === 'granted'
    }
    return hasPermission
}

type OnLoadImage = NativeSyntheticEvent<ImageLoadEventData>
const isVideoOnLoadEvent = (event: OnLoadData | OnLoadImage): event is OnLoadData => 'duration' in event && 'naturalSize' in event

type Props = NativeStackScreenProps<RootStackParamList, 'MediaPage'>

const MediaPageView = styled.View`
    flex: 1;
    align-items: center;
    justify-content: center;
    background-color: center;
`
const CloseButton = styled(PressableOpacity)`
    position: absolute;
    top: ${SAFE_AREA_PADDING.paddingTop}px;
    left: ${SAFE_AREA_PADDING.paddingLeft}px;
    width: 40px;
    height: 40px;
`;

const SaveButton = styled(PressableOpacity)`
    position: absolute;
    bottom: ${SAFE_AREA_PADDING.paddingBottom}px;
    left: ${SAFE_AREA_PADDING.paddingLeft}px;
    width: 40px;
    height: 40px;
`;

const StyledIcon = styled.View`
    text-shadow-color: black;
    text-shadow-offset: {
        height: 0,
        width: 0,
    };
    text-shadow-radius: 1;
`;

export function MediaPage({ navigation, route }: Props): React.ReactElement {
    const { path, type } = route.params
    const [hasMediaLoaded, setHasMediaLoaded] = useState(false)
    const isForeground = useIsForeground()
    const isScreenFocused = useIsFocused()
    const isVideoPaused = !isForeground || !isScreenFocused
    const [savingState, setSavingState] = useState<'none' | 'saving' | 'saved'>('none')

    const onMediaLoad = useCallback((event: OnLoadData | OnLoadImage) => {
        if (isVideoOnLoadEvent(event)) {
            console.log(
                `Video loaded. Size: ${event.naturalSize.width}x${event.naturalSize.height} (${event.naturalSize.orientation}, ${event.duration} seconds)`,
            )
        } else {
            const source = event.nativeEvent.source
            console.log(`Image loaded. Size: ${source.width}x${source.height}`)
        }
    }, [])
    const onMediaLoadEnd = useCallback(() => {
        console.log('media has loaded.')
        setHasMediaLoaded(true)
    }, [])
    const onMediaLoadError = useCallback((error: OnVideoErrorData) => {
        console.log(`failed to load media: ${JSON.stringify(error)}`)
    }, [])

    const onSavePressed = useCallback(async () => {
        try {
            setSavingState('saving')

            const hasPermission = await requestSavePermission()
            if (!hasPermission) {
                Alert.alert('Permission denied!', 'Found does not have permission to save the media to your camera roll.')
                return
            }
            await CameraRoll.save(`file://${path}`, {
                type: type,
            })
            setSavingState('saved')
        } catch (e) {
            const message = e instanceof Error ? e.message : JSON.stringify(e)
            setSavingState('none')
            Alert.alert('Failed to save!', `An unexpected error occured while trying to save your ${type}. ${message}`)
        }
    }, [path, type])

    const source = useMemo(() => ({ uri: `file://${path}` }), [path])

    const screenStyle = useMemo(() => ({ opacity: hasMediaLoaded ? 1 : 0 }), [hasMediaLoaded])

    return (
        <MediaPageView style={[screenStyle]}>
            {type === 'photo' && (
                <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" onLoadEnd={onMediaLoadEnd} onLoad={onMediaLoad} />
            )}
            {type === 'video' && (
                <Video
                    source={source}
                    style={StyleSheet.absoluteFill}
                    paused={isVideoPaused}
                    resizeMode="cover"
                    posterResizeMode="cover"
                    allowsExternalPlayback={false}
                    automaticallyWaitsToMinimizeStalling={false}
                    disableFocus={true}
                    repeat={true}
                    useTextureView={false}
                    controls={false}
                    playWhenInactive={true}
                    ignoreSilentSwitch="ignore"
                    onReadyForDisplay={onMediaLoadEnd}
                    onLoad={onMediaLoad}
                    onError={onMediaLoadError}
                />
            )}

            <CloseButton onPress={navigation.goBack}>
                <IonIcon name="close" size={35} color="white" style={styles.icon} />
            </CloseButton>

            <SaveButton onPress={onSavePressed} disabled={savingState !== 'none'}>
                {savingState === 'none' && <IonIcon name="download" size={35} color="white" style={styles.icon} />}
                {savingState === 'saved' && <IonIcon name="checkmark" size={35} color="white" style={styles.icon} />}
                {savingState === 'saving' && <ActivityIndicator color="white" />}
            </SaveButton>

            <StatusBarBlurBackground />
        </MediaPageView>
    )
}

const styles = StyleSheet.create({
    icon: {
        textShadowColor: 'black',
        textShadowOffset: {
            height: 0,
            width: 0,
        },
        textShadowRadius: 1,
    },
})