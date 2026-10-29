BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[InventoryLog] (
    [id] INT NOT NULL IDENTITY(1,1),
    [variantId] INT NOT NULL,
    [change] INT NOT NULL,
    [stockAfter] INT NOT NULL,
    [reason] VARCHAR(20) NOT NULL,
    [note] NVARCHAR(255),
    [orderId] INT,
    [createdById] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InventoryLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [InventoryLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InventoryLog_variantId_createdAt_idx] ON [dbo].[InventoryLog]([variantId], [createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[InventoryLog] ADD CONSTRAINT [InventoryLog_variantId_fkey] FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
