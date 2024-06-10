import { Route } from '@react-navigation/native';
import React, { PureComponent } from 'react';
import { WithTranslation } from 'react-i18next';
import { View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { connect } from 'react-redux';

import { IReduxState, IStore } from '../../../app/types';
import { getCurrentConference } from '../../../base/conference/functions';
import { IJitsiConference } from '../../../base/conference/reducer';
import { openDialog } from '../../../base/dialog/actions';
import { translate } from '../../../base/i18n/functions';
import JitsiScreen from '../../../base/modal/components/JitsiScreen';
import LoadingIndicator from '../../../base/react/components/native/LoadingIndicator';
import { safeDecodeURIComponent } from '../../../base/util/uri';
import { setupWhiteboard } from '../../actions.any';
import { WHITEBOARD_ID } from '../../constants';
import { getCollabServerUrl, getWhiteboardInfoForURIString } from '../../functions';

import WhiteboardErrorDialog from './WhiteboardErrorDialog';
import styles, { INDICATOR_COLOR } from './styles';

interface IProps extends WithTranslation {

    /**
     * The whiteboard collab server url.
     */
    collabServerUrl?: string;

    /**
     * The current Jitsi conference.
     */
    conference?: IJitsiConference;

    /**
     * Redux store dispatch method.
     */
    dispatch: IStore['dispatch'];

    /**
     * Window location href.
     */
    locationHref: string;

    /**
     * Default prop for navigating between screen components(React Navigation).
     */
    navigation: any;

    /**
     * Default prop for navigating between screen components(React Navigation).
     */
    route: Route<'', {
        collabDetails: { roomId: string; roomKey: string; };
        collabServerUrl: string;
        localParticipantName: string;
    }>;
}

/**
 * Implements a React native component that displays the whiteboard page for a specific room.
 */
class Whiteboard extends PureComponent<IProps> {

    /**
     * Initializes a new instance.
     *
     * @inheritdoc
     */
    constructor(props: IProps) {
        super(props);

        this._onError = this._onError.bind(this);
        this._onNavigate = this._onNavigate.bind(this);
        this._onMessage = this._onMessage.bind(this);
        this._renderLoading = this._renderLoading.bind(this);
    }

    /**
     * Implements React's {@link Component#componentDidMount()}. Invoked
     * immediately after mounting occurs.
     *
     * @inheritdoc
     * @returns {void}
     */
    componentDidMount() {
        const { navigation, t } = this.props;

        navigation.setOptions({
            headerTitle: t('whiteboard.screenTitle')
        });
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     */
    render() {
        const { locationHref, route } = this.props;
        const collabServerUrl = safeDecodeURIComponent(route.params?.collabServerUrl);
        const localParticipantName = safeDecodeURIComponent(route.params?.localParticipantName);
        const collabDetails = route.params?.collabDetails;
        const uri = getWhiteboardInfoForURIString(
            locationHref,
            collabServerUrl,
            collabDetails,
            localParticipantName
        ) ?? '';

        return (
            <JitsiScreen
                safeAreaInsets = { [ 'bottom', 'left', 'right' ] }
                style = { styles.backDrop }>
                <WebView
                    incognito = { true }
                    javaScriptEnabled = { true }
                    nestedScrollEnabled = { true }
                    onError = { this._onError }
                    onMessage = { this._onMessage }
                    onShouldStartLoadWithRequest = { this._onNavigate }
                    renderLoading = { this._renderLoading }
                    scrollEnabled = { true }
                    setSupportMultipleWindows = { false }
                    source = {{ uri }}
                    startInLoadingState = { true }
                    style = { styles.webView } />
            </JitsiScreen>
        );
    }

    /**
     * Callback to handle the error if the page fails to load.
     *
     * @returns {void}
     */
    _onError() {
        this.props.dispatch(openDialog(WhiteboardErrorDialog));
    }

    /**
     * Callback to intercept navigation inside the webview and make the native app handle the whiteboard requests.
     *
     * NOTE: We don't navigate to anywhere else from that view.
     *
     * @param {any} request - The request object.
     * @returns {boolean}
     */
    _onNavigate(request: { url: string; }) {
        const { url } = request;
        const { locationHref, route } = this.props;
        const collabServerUrl = route.params?.collabServerUrl;
        const collabDetails = route.params?.collabDetails;
        const localParticipantName = route.params?.localParticipantName;

        return url === getWhiteboardInfoForURIString(
            locationHref,
            collabServerUrl,
            collabDetails,
            localParticipantName
        );
    }

    /**
     * Callback to handle the message events.
     *
     * @param {any} event - The event.
     * @returns {void}
     */
    _onMessage(event: any) {
        const { collabServerUrl, conference } = this.props;
        const collabDetails = JSON.parse(event.nativeEvent.data);

        if (collabDetails?.roomId && collabDetails?.roomKey) {
            this.props.dispatch(setupWhiteboard({ collabDetails }));

            // Broadcast the collab details.
            conference?.getMetadataHandler().setMetadata(WHITEBOARD_ID, {
                collabServerUrl,
                collabDetails
            });
        }
    }

    /**
     * Renders the loading indicator.
     *
     * @returns {React$Component<any>}
     */
    _renderLoading() {
        return (
            <View style = { styles.indicatorWrapper as ViewStyle }>
                <LoadingIndicator
                    color = { INDICATOR_COLOR }
                    size = 'large' />
            </View>
        );
    }
}

/**
 * Maps (parts of) the redux state to the associated
 * {@code WaitForOwnerDialog}'s props.
 *
 * @param {Object} state - The redux state.
 * @private
 * @returns {IProps}
 */
function mapStateToProps(state: IReduxState) {
    const { locationURL } = state['features/base/connection'];
    const { href = '' } = locationURL ?? {};

    return {
        conference: getCurrentConference(state),
        collabServerUrl: getCollabServerUrl(state),
        locationHref: href
    };
}

export default translate(connect(mapStateToProps)(Whiteboard));
