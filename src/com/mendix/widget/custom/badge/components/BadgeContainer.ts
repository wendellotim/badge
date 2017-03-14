import { Component, createElement } from "react";

import { Badge } from "./Badge";
import { Alert } from "./Alert";

interface BadgeContainerProps {
    contextObject: mendix.lib.MxObject;
    valueAttribute: string;
    styleAttribute: string;
    labelAttribute: string;
    label: string;
    badgeClass: string;
    microflow: string;
    onClickEvent: OnClickOptions;
    page: string;
    pageSettings: PageSettings;
}

interface BadgeContainerState {
    alertMessage?: string;
    badgeValue: string;
    label: string;
    showAlert?: boolean;
    style: string;
}

type OnClickOptions = "doNothing" | "showPage" | "callMicroflow";
type PageSettings = "content" | "popup" | "modal";

class BadgeContainer extends Component<BadgeContainerProps, BadgeContainerState> {
    private subscriptionHandles: number[];

    constructor(props: BadgeContainerProps) {
        super(props);

        this.state = {
            alertMessage: this.validateProps(),
            badgeValue: this.getValue(props.contextObject, props.valueAttribute, ""),
            label: this.getValue(props.contextObject, props.labelAttribute, this.props.label),
            showAlert: !!this.validateProps(),
            style: this.getValue(props.contextObject, props.styleAttribute, props.badgeClass)
        };
        this.resetSubscriptions(props.contextObject);
        this.handleOnClick = this.handleOnClick.bind(this);
    }

    render() {
        if (this.state.showAlert) {
            return createElement(Alert, { message: this.state.alertMessage });
        }

        return createElement(Badge, {
            alertMessage: this.state.alertMessage,
            badgeValue: this.state.badgeValue,
            clickable: !!this.props.microflow,
            label: this.state.label,
            onClickAction: this.handleOnClick,
            style: this.state.style
        });
    }

    componentWillReceiveProps(newProps: BadgeContainerProps) {
        this.resetSubscriptions(newProps.contextObject);
        this.updateValues(newProps.contextObject);
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    private updateValues(contextObject: mendix.lib.MxObject) {
        this.setState({
            badgeValue: this.getValue(contextObject, this.props.valueAttribute, ""),
            label: this.getValue(contextObject, this.props.labelAttribute, this.props.label),
            style: this.getValue(contextObject, this.props.styleAttribute, this.props.badgeClass)
        });
    }

    private getValue(contextObject: mendix.lib.MxObject, attributeName: string, defaultValue: string) {
        if (contextObject) {
            return contextObject.get(attributeName) as string || defaultValue;
        }
        return defaultValue;
    }

    private resetSubscriptions(contextObject: mendix.lib.MxObject) {
        this.unsubscribe();

        this.subscriptionHandles = [];
        if (contextObject) {
            this.subscriptionHandles.push(window.mx.data.subscribe({
                callback: () => this.updateValues(contextObject),
                guid: contextObject.getGuid()
            }));

            [ this.props.valueAttribute, this.props.styleAttribute, this.props.labelAttribute ].forEach((attr) =>
                this.subscriptionHandles.push(window.mx.data.subscribe({
                    attr,
                    callback: () => this.updateValues(contextObject),
                    guid: contextObject.getGuid()
                }))
            );
        }
    }

    private unsubscribe() {
        if (this.subscriptionHandles) {
            this.subscriptionHandles.forEach((handle) => window.mx.data.unsubscribe(handle));
        }
    }

    private validateProps(): string {
        let errorMessage = "";
        if (this.props.onClickEvent === "callMicroflow" && !this.props.microflow) {
            errorMessage = "on click microflow is required";
        } else if (this.props.onClickEvent === "showPage" && !this.props.page) {
            errorMessage = "on click page is required";
        }
        if (errorMessage) {
            errorMessage = `Error in badge configuration: ${errorMessage}`;
        }

        return errorMessage;
    }

    private handleOnClick() {
        const { contextObject, onClickEvent, microflow, page } = this.props;
        const context = new mendix.lib.MxContext();
        context.setContext(contextObject.getEntity(), contextObject.getGuid());
        if (onClickEvent === "callMicroflow" && microflow && contextObject.getGuid()) {
            window.mx.ui.action(microflow, {
                context,
                error: (error) => {
                    this.setState({
                        alertMessage:
                        `Error while executing microflow: ${microflow}: ${error.message}`,
                        showAlert: false
                    });
                },
                params: {
                    applyto: "selection",
                    guids: [ contextObject.getGuid() ]
                }
            });
        } else if (onClickEvent === "showPage" && page && contextObject.getGuid()) {
            window.mx.ui.openForm(page, {
                context,
                error: (error) =>
                    this.setState({
                        alertMessage: `Error while opening page ${page}: ${error.message}`,
                        showAlert: false
                    }),
                location: this.props.pageSettings
            });
        }
    }
}

export { BadgeContainer as default, OnClickOptions, PageSettings };
