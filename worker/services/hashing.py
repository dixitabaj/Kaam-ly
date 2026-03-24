from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)

class Hash:
    @staticmethod
    def bcrypt(password: str):
        return ph.hash(password)

    @staticmethod
    def verify(plain_password: str, hashed_password: str):
        try:
            return ph.verify(hashed_password, plain_password)
        except (VerifyMismatchError, VerificationError):
            return False
        

