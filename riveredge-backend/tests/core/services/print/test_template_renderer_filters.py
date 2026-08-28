from core.services.print.template_renderer import render_jinja_template


def test_jinja_format_filter_accepts_amount_string():
    html = render_jinja_template(
        '{{ "%.2f"|format(total_amount) }}',
        {"total_amount": "30440.00"},
    )
    assert html == "30440.00"


def test_jinja_money_filter_accepts_amount_string():
    html = render_jinja_template(
        "{{ total_amount | money }}",
        {"total_amount": "30440.00"},
    )
    assert html == "30,440.00"
