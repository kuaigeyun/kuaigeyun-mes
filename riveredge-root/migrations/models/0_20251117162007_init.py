from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "aerich" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "version" VARCHAR(255) NOT NULL,
    "app" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL
);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        """


MODELS_STATE = (
    "eJzVlN1LwzAUxf+V0SeFKa5uKr7NgajoBL8QZJSsvevC0qRLbv1A9r+bm26m6+ZQ8EHf1n"
    "NPknN+JHsPMpWAMLtd0DweB8eN90CyDOyP2qTZCFiee50EZEPhrMx7hgY1i9GqIyYMWCkB"
    "E2ueI1fSqrIQgkQVWyOXqZcKyacFRKhSwDFoO3gaWJnLBF7BLD7zSTTiIJKlqDyhs50e4V"
    "vutHOJp85Ipw2jWIkik96cv+FYyU83l0hqChI0Q6DtURcUn9LNey4alUm9pYxYWZPAiBUC"
    "K3W/ySBWkvjZNMYVTOmUnbDVPmwf7R+0j6zFJflUDmdlPd+9XOgI9O+CmZszZKXDYfTcnk"
    "EbirQCrzdmej29ypIaQhu8jnABbBPDheAh+ovzSxQz9hoJkCnSBQ87nQ3MHro3vbPuzZZ1"
    "bVMbZS9zecf781FYzgisB0lP4wcQ5/b/CbC1t/cNgNb1JUA3WwZoT0Qo3+AyxIvb6/56iJ"
    "UlNZD30hZ8SniMzYbgBgd/E+sGitSaQmfGTEUV3tZV97HOtXd5feIoKIOpdru4DU4sY/rL"
    "HE0qj5+EIYsnL0wn0cpEheor7+ooC7O6wiRLHStqPJt9AHkzByE="
)
