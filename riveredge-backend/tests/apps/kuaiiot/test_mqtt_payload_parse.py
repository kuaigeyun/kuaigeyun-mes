"""MQTT 入站解析测试。"""

from apps.kuaiiot.services.mqtt_subscriber_service import MqttSubscriberService


class TestMqttPayloadParse:
    def test_extract_device_token_from_topic(self):
        assert MqttSubscriberService._extract_device_token("kuaiiot/ingest/abc123") == "abc123"
        assert MqttSubscriberService._extract_device_token("tenant/gateway/device/token") == "token"

    def test_extract_device_token_empty(self):
        assert MqttSubscriberService._extract_device_token("") is None
