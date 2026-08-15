import uuid

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_hash_password_roundtrip():
    hashed = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong password", hashed)


def test_hash_password_salts_each_call():
    assert hash_password("same-password") != hash_password("same-password")


def test_access_token_roundtrip():
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    assert decode_access_token(token) == user_id


def test_decode_access_token_rejects_garbage():
    assert decode_access_token("not-a-real-token") is None
