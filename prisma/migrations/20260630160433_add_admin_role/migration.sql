-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('donor', 'recipient', 'admin') NOT NULL;
